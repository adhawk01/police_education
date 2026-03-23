"""
repositories/home_repository.py
--------------------------------
Provides all data queries required by the home page.

Methods:
    get_categories()     -> list of active top-level categories
    get_featured_items() -> list of published, featured content items
    get_regions()        -> list of all regions for the filter bar
"""

try:
    # Works when backend/ is the active source root.
    from db import db_connection
except ImportError:
    # Works when the project root is the active source root.
    from backend.db import db_connection


class HomeRepository:
    """Read-only queries for the home page."""

    @staticmethod
    def _print_sql_error(method_name: str, sql: str, error: Exception, params: tuple | None = None) -> None:
        """Print clear debug information when a repository query fails."""
        print(f"[HomeRepository.{method_name}] SQL failed")
        print(f"Error: {error}")
        if params is not None:
            print(f"Params: {params}")
        print("SQL:")
        print(sql.strip())

    # ------------------------------------------------------------------
    # Categories
    # ------------------------------------------------------------------

    def get_categories(self) -> list:
        """
        Return all active top-level categories, ordered by sort_order.

        Only top-level categories are returned (parent_id IS NULL) so the
        home page can render the main navigation tiles.

        Returns a list of dicts, e.g.:
            [
                {
                    "id": 1,
                    "name": "מוזיאונים",
                    "slug": "museums",
                    "icon_name": "icon-museum",
                    "color_code": "#3a7bd5",
                    "description":  "קטגוריית מוזיאונים כוללת את כל המוזיאונים ברחבי הארץ, עם מידע על התערוכות, שעות פתיחה ועוד."
                },
                ...
            ]
        """
        sql = """
            SELECT
                id,
                name,
                slug,
                icon_name,
                color_code,
                description
            FROM  categories
            WHERE parent_id IS NULL
              AND is_active  = 1
            ORDER BY sort_order ASC, name ASC
        """
        try:
            with db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql)
                return cursor.fetchall()
        except Exception as exc:
            self._print_sql_error("get_categories", sql, exc)
            raise

    # ------------------------------------------------------------------
    # Featured content items
    # ------------------------------------------------------------------

    def get_featured_items(self, limit: int = 10) -> list:
        """
        Return published, active, featured content items for the home page.

        Joins:
            - content_types          to include the human-readable type label
            - content_item_statuses  to filter only items with code = 'published'
            - content_media          (left) to find the designated primary image
            - media_files            (left) to get the actual image URL

        Args:
            limit: maximum number of items to return (default 10)

        Returns a list of dicts, e.g.:
            [
                {
                    "id": 5,
                    "title": "מוזיאון המשטרה",
                    "short_description": "סיור מודרך ...",
                    "full_description": "תיאור מלא של התוכן ...",
                    "is_featured": 1,
                    "content_type": "place",
                    "published_at": datetime(2025, 1, 15, 10, 0),
                    "category_id": 2,
                    "category_name": "הדרכה",
                    "category_color": "#3a7bd5",  # None if no category mapping exists
                    "primary_image_url": "https://cdn.example.com/img.jpg",  # None if missing
                    "location_name": "ירושלים",
                    "address": "רחוב יפו 1",
                    "region_name": "ירושלים",
                    "latitude": 31.7683,
                    "longitude": 35.2137
                },
                ...
            ]
        """
        sql = """
            SELECT
                ci.id,
                ci.title,
                ci.short_description,
                ci.full_description,
                ci.is_featured,
                ct.code        AS content_type,
                ci.published_at,
                top_cat.category_id,
                top_cat.category_name,
                top_cat.color_code AS category_color,
                mf.file_url    AS primary_image_url,
                primary_loc.location_name,
                primary_loc.address,
                primary_loc.region_name,
                primary_loc.latitude,
                primary_loc.longitude
            FROM  content_items          ci
            JOIN  content_types          ct  ON ct.id  = ci.content_type_id
            JOIN  content_item_statuses  cis ON cis.id = ci.status_id
            -- pick the highest-priority category per content item (lowest priority number wins)
            LEFT JOIN (
                SELECT
                    ranked.content_item_id,
                    c.id   AS category_id,
                    c.name AS category_name,
                    c.color_code
                FROM (
                    SELECT
                        cc.content_item_id,
                        cc.category_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY cc.content_item_id
                            ORDER BY cc.priority ASC, cc.category_id ASC
                        ) AS rn
                    FROM content_categories cc
                ) ranked
                JOIN categories c ON c.id = ranked.category_id
                WHERE ranked.rn = 1
            ) top_cat ON top_cat.content_item_id = ci.id
            -- pick a single location per content item, preferring the primary one when available
            LEFT JOIN (
                SELECT
                    ranked.content_item_id,
                    l.place_name AS location_name,
                    l.address_line AS address,
                    r.name       AS region_name,
                    l.latitude,
                    l.longitude
                FROM (
                    SELECT
                        cl.content_item_id,
                        cl.location_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY cl.content_item_id
                            ORDER BY cl.is_primary DESC, cl.location_id ASC
                        ) AS rn
                    FROM content_locations cl
                ) ranked
                JOIN locations l ON l.id = ranked.location_id
                JOIN regions r ON r.id = l.region_id
                WHERE ranked.rn = 1
            ) primary_loc ON primary_loc.content_item_id = ci.id
            -- primary image only; LEFT JOIN keeps items that have no media
            LEFT JOIN content_media      cm  ON cm.content_item_id = ci.id
                                             AND cm.is_primary      = 1
            LEFT JOIN media_files        mf  ON mf.id = cm.media_file_id
            WHERE ci.is_active   = 1
              AND cis.code       = 'published'
            ORDER BY ci.published_at DESC
            LIMIT %s
        """
        params = (limit,)
        try:
            with db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql, params)
                return cursor.fetchall()
        except Exception as exc:
            self._print_sql_error("get_featured_items", sql, exc, params)
            raise

    # ------------------------------------------------------------------
    # Content types
    # ------------------------------------------------------------------

    def get_content_types(self) -> list:
        """
        Return all content types.

        Used by the frontend to decide which visual component/view to render
        for each content item type.

        Returns a list of dicts, e.g.:
            [
                {"code": "place", "name": "מקום"},
                {"code": "activity", "name": "פעילות"},
                ...
            ]
        """
        sql = """
            SELECT
                code,
                name
            FROM content_types
            ORDER BY name ASC
        """
        try:
            with db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql)
                return cursor.fetchall()
        except Exception as exc:
            self._print_sql_error("get_content_types", sql, exc)
            raise

    # ------------------------------------------------------------------
    # Regions
    # ------------------------------------------------------------------

    def get_regions(self) -> list:
        """
        Return all regions, ordered by sort_order.

        Used to populate the region filter on the home and search pages.

        Returns a list of dicts, e.g.:
            [
                {"id": 1, "name": "צפון"},
                {"id": 2, "name": "חיפה והסביבה"},
                {"id": 3, "name": "מרכז"},
                ...
            ]
        """
        sql = """
            SELECT
                id,
                name
            FROM  regions
            ORDER BY sort_order ASC, name ASC
        """
        try:
            with db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql)
                return cursor.fetchall()
        except Exception as exc:
            self._print_sql_error("get_regions", sql, exc)
            raise

