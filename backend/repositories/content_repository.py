"""Repository queries for content details page."""

from __future__ import annotations

from typing import Any

try:
    # Works when backend/ is the active source root.
    from db import db_connection
except ImportError:
    # Works when workspace root is the active source root.
    from backend.db import db_connection


class ContentRepository:
    """Read-only data access for content details API."""

    @staticmethod
    def _print_sql_error(method_name: str, sql: str, error: Exception, params: tuple | None = None) -> None:
        print(f"[ContentRepository.{method_name}] SQL failed")
        print(f"Error: {error}")
        if params is not None:
            print(f"Params: {params}")
        print("SQL:")
        print(sql.strip())

    def get_content_item_details(self, content_item_id: int) -> dict[str, Any] | None:
        """Return full content details payload source data for a published+active item."""
        base = self._get_base_content_item(content_item_id)
        if not base:
            return None

        base["categories"] = self._get_categories(content_item_id)
        base["tags"] = self._get_tags(content_item_id)
        base["gallery_images"] = self._get_gallery_images(content_item_id)
        base["accessibility_features"] = self._get_accessibility_features(content_item_id)
        base["audience_types"] = self._get_audience_types(content_item_id)
        base["recommended_items"] = self._get_recommended_items(content_item_id)
        return base

    def _get_base_content_item(self, content_item_id: int) -> dict[str, Any] | None:
        sql = """
            SELECT
                ci.id,
                ci.title,
                ci.short_description,
                ci.full_description,
                ci.audience_notes,
                ci.is_featured,
                ct.code AS activity_type_code,
                ct.name AS activity_type_name,
                cis.code AS status_code,
                cis.name AS status_text,
                media.primary_image_url,
                loc.area,
                loc.city,
                loc.address,
                loc.latitude,
                loc.longitude,
                loc.accessibility_notes,
                op.min_participants,
                op.max_participants,
                op.price_type,
                op.price_min,
                op.price_max,
                op.currency,
                op.phone,
                op.email,
                op.website_url,
                op.booking_url,
                sched.opening_days,
                tod.time_of_day_names
            FROM content_items ci
            JOIN content_types ct ON ct.id = ci.content_type_id
            JOIN content_item_statuses cis ON cis.id = ci.status_id
            LEFT JOIN content_operational_details op ON op.content_item_id = ci.id
            LEFT JOIN (
                SELECT ranked.content_item_id, mf.file_url AS primary_image_url
                FROM (
                    SELECT
                        cm.content_item_id,
                        cm.media_file_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY cm.content_item_id
                            ORDER BY cm.is_primary DESC, cm.sort_order ASC, cm.media_file_id ASC
                        ) AS rn
                    FROM content_media cm
                ) ranked
                JOIN media_files mf ON mf.id = ranked.media_file_id
                WHERE ranked.rn = 1
            ) media ON media.content_item_id = ci.id
            LEFT JOIN (
                SELECT
                    ranked.content_item_id,
                    r.name AS area,
                    c.name AS city,
                    l.address_line AS address,
                    l.latitude,
                    l.longitude,
                    l.accessibility_notes
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
                LEFT JOIN cities c ON c.id = l.city_id
                WHERE ranked.rn = 1
            ) loc ON loc.content_item_id = ci.id
            LEFT JOIN (
                SELECT
                    oh.content_item_id,
                    GROUP_CONCAT(DISTINCT CAST(oh.day_of_week AS CHAR) ORDER BY oh.day_of_week ASC SEPARATOR ',') AS opening_days
                FROM opening_hours oh
                GROUP BY oh.content_item_id
            ) sched ON sched.content_item_id = ci.id
            LEFT JOIN (
                SELECT
                    ctd.content_item_id,
                    GROUP_CONCAT(DISTINCT tdo.name ORDER BY tdo.sort_order ASC, tdo.name ASC SEPARATOR ', ') AS time_of_day_names
                FROM content_time_of_day ctd
                JOIN time_of_day_options tdo ON tdo.id = ctd.time_of_day_id
                GROUP BY ctd.content_item_id
            ) tod ON tod.content_item_id = ci.id
            WHERE ci.id = %s
              AND ci.is_active = 1
              AND cis.code = 'published'
            LIMIT 1
        """
        params = (content_item_id,)
        try:
            with db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql, params)
                return cursor.fetchone()
        except Exception as exc:
            self._print_sql_error("_get_base_content_item", sql, exc, params)
            raise

    def _get_categories(self, content_item_id: int) -> list[dict[str, Any]]:
        sql = """
            SELECT
                c.id,
                c.name,
                c.color_code,
                cc.priority
            FROM content_categories cc
            JOIN categories c ON c.id = cc.category_id
            WHERE cc.content_item_id = %s
            ORDER BY cc.priority ASC, c.id ASC
        """
        params = (content_item_id,)
        try:
            with db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql, params)
                return cursor.fetchall()
        except Exception as exc:
            self._print_sql_error("_get_categories", sql, exc, params)
            raise

    def _get_tags(self, content_item_id: int) -> list[dict[str, Any]]:
        sql = """
            SELECT
                t.id,
                t.name,
                t.slug
            FROM content_tags ct
            JOIN tags t ON t.id = ct.tag_id
            WHERE ct.content_item_id = %s
            ORDER BY t.name ASC
        """
        params = (content_item_id,)
        try:
            with db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql, params)
                return cursor.fetchall()
        except Exception as exc:
            self._print_sql_error("_get_tags", sql, exc, params)
            raise

    def _get_gallery_images(self, content_item_id: int) -> list[dict[str, Any]]:
        sql = """
            SELECT
                ranked.media_file_id AS id,
                mf.file_url AS url,
                mf.alt_text AS alt
            FROM (
                SELECT
                    cm.content_item_id,
                    cm.media_file_id,
                    ROW_NUMBER() OVER (
                        PARTITION BY cm.content_item_id
                        ORDER BY cm.is_primary DESC, cm.sort_order ASC, cm.media_file_id ASC
                    ) AS rn
                FROM content_media cm
                WHERE cm.content_item_id = %s
            ) ranked
            JOIN media_files mf ON mf.id = ranked.media_file_id
            WHERE ranked.rn > 1
            ORDER BY ranked.rn ASC
        """
        params = (content_item_id,)
        try:
            with db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql, params)
                return cursor.fetchall()
        except Exception as exc:
            self._print_sql_error("_get_gallery_images", sql, exc, params)
            raise

    def _get_accessibility_features(self, content_item_id: int) -> list[dict[str, Any]]:
        sql = """
            SELECT
                af.id,
                af.name
            FROM content_accessibility ca
            JOIN accessibility_features af ON af.id = ca.accessibility_feature_id
            WHERE ca.content_item_id = %s
            ORDER BY af.sort_order ASC, af.name ASC
        """
        params = (content_item_id,)
        try:
            with db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql, params)
                return cursor.fetchall()
        except Exception as exc:
            self._print_sql_error("_get_accessibility_features", sql, exc, params)
            raise

    def _get_audience_types(self, content_item_id: int) -> list[dict[str, Any]]:
        sql = """
            SELECT
                at.id,
                at.name
            FROM content_audiences ca
            JOIN audience_types at ON at.id = ca.audience_type_id
            WHERE ca.content_item_id = %s
            ORDER BY at.sort_order ASC, at.name ASC
        """
        params = (content_item_id,)
        try:
            with db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql, params)
                return cursor.fetchall()
        except Exception as exc:
            self._print_sql_error("_get_audience_types", sql, exc, params)
            raise

    def _get_recommended_items(self, content_item_id: int, limit: int = 6) -> list[dict[str, Any]]:
        sql = """
            SELECT
                ci.id,
                ci.title,
                ci.short_description,
                media.primary_image_url AS image_url
            FROM related_content rc
            JOIN content_items ci ON ci.id = rc.target_content_item_id
            JOIN content_item_statuses cis ON cis.id = ci.status_id
            LEFT JOIN (
                SELECT ranked.content_item_id, mf.file_url AS primary_image_url
                FROM (
                    SELECT
                        cm.content_item_id,
                        cm.media_file_id,
                        ROW_NUMBER() OVER (
                            PARTITION BY cm.content_item_id
                            ORDER BY cm.is_primary DESC, cm.sort_order ASC, cm.media_file_id ASC
                        ) AS rn
                    FROM content_media cm
                ) ranked
                JOIN media_files mf ON mf.id = ranked.media_file_id
                WHERE ranked.rn = 1
            ) media ON media.content_item_id = ci.id
            WHERE rc.source_content_item_id = %s
              AND rc.relation_type = 'recommended'
              AND ci.is_active = 1
              AND cis.code = 'published'
            ORDER BY ci.published_at DESC, ci.id DESC
            LIMIT %s
        """
        params = (content_item_id, limit)
        try:
            with db_connection() as conn:
                cursor = conn.cursor(dictionary=True)
                cursor.execute(sql, params)
                return cursor.fetchall()
        except Exception as exc:
            self._print_sql_error("_get_recommended_items", sql, exc, params)
            raise

