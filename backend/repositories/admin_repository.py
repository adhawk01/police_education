"""Repository queries for admin/site-manager content management."""

from __future__ import annotations

from typing import Any

from mysql.connector import Error

try:
    # Works when backend/ is the active source root.
    from db import db_connection
except ImportError:
    # Works when workspace root is the active source root.
    from backend.db import db_connection


class AdminRepository:
    """Data access layer for protected admin content endpoints."""

    @staticmethod
    def _build_in_clause(values: list[Any]) -> str:
        return ", ".join(["%s"] * len(values))

    def list_content_items(self, filters: dict[str, Any]) -> dict[str, Any]:
        """Return paginated content list for the management table."""
        where_sql, params = self._build_list_where(filters)
        sort_sql = self._build_list_sort(filters.get("sort_by"))

        page = int(filters.get("page", 1))
        page_size = int(filters.get("page_size", 20))
        offset = (page - 1) * page_size

        count_sql = f"""
            SELECT COUNT(DISTINCT ci.id) AS total_count
            FROM content_items ci
            JOIN content_item_statuses cis ON cis.id = ci.status_id
            JOIN content_types ct ON ct.id = ci.content_type_id
            {where_sql}
        """

        ids_sql = f"""
            SELECT ci.id
            FROM content_items ci
            JOIN content_item_statuses cis ON cis.id = ci.status_id
            JOIN content_types ct ON ct.id = ci.content_type_id
            {where_sql}
            ORDER BY {sort_sql}
            LIMIT %s OFFSET %s
        """

        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)

            cursor.execute(count_sql, tuple(params))
            total_count = int(cursor.fetchone()["total_count"])

            ids_params = tuple(params) + (page_size, offset)
            cursor.execute(ids_sql, ids_params)
            page_ids = [row["id"] for row in cursor.fetchall()]

            if not page_ids:
                return {
                    "total_count": total_count,
                    "page": page,
                    "page_size": page_size,
                    "rows": [],
                }

            details_sql, details_params = self._build_list_details_query(page_ids)
            cursor.execute(details_sql, details_params)
            rows = cursor.fetchall()

        return {
            "total_count": total_count,
            "page": page,
            "page_size": page_size,
            "rows": rows,
        }

    def get_content_item_for_edit(self, content_item_id: int) -> dict[str, Any] | None:
        """Return full content payload for the admin edit page."""
        base_sql = """
            SELECT
                ci.id,
                ci.content_type_id,
                ci.title,
                ci.short_description,
                ci.full_description,
                ci.audience_notes,
                ci.status_id,
                cis.code AS status_code,
                cis.name AS status_name,
                ci.is_featured,
                ci.is_active,
                ci.published_at,
                ci.created_at,
                ci.updated_at
            FROM content_items ci
            JOIN content_item_statuses cis ON cis.id = ci.status_id
            WHERE ci.id = %s
            LIMIT 1
        """

        categories_sql = """
            SELECT
                cc.category_id,
                c.name AS category_name,
                c.color_code,
                cc.priority
            FROM content_categories cc
            JOIN categories c ON c.id = cc.category_id
            WHERE cc.content_item_id = %s
            ORDER BY cc.priority ASC, cc.category_id ASC
        """

        location_sql = """
            SELECT
                l.id AS location_id,
                r.id AS area_id,
                r.name AS area_name,
                c.id AS city_id,
                c.name AS city_name,
                l.place_name,
                l.address_line,
                l.latitude,
                l.longitude,
                cl.is_primary
            FROM content_locations cl
            JOIN locations l ON l.id = cl.location_id
            JOIN regions r ON r.id = l.region_id
            LEFT JOIN cities c ON c.id = l.city_id
            WHERE cl.content_item_id = %s
            ORDER BY cl.is_primary DESC, cl.location_id ASC
            LIMIT 1
        """

        operational_sql = """
            SELECT
                duration_minutes,
                min_participants,
                max_participants,
                price_type,
                price_min,
                price_max,
                currency,
                booking_required,
                security_benefit_available,
                security_benefit_notes,
                website_url,
                booking_url,
                phone,
                email
            FROM content_operational_details
            WHERE content_item_id = %s
            LIMIT 1
        """

        media_sql = """
            SELECT
                cm.media_file_id,
                mf.file_url,
                mf.alt_text,
                cm.media_type,
                cm.is_primary,
                cm.sort_order
            FROM content_media cm
            JOIN media_files mf ON mf.id = cm.media_file_id
            WHERE cm.content_item_id = %s
            ORDER BY cm.is_primary DESC, cm.sort_order ASC, cm.media_file_id ASC
        """

        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(base_sql, (content_item_id,))
            base = cursor.fetchone()
            if not base:
                return None

            cursor.execute(categories_sql, (content_item_id,))
            base["categories"] = cursor.fetchall()

            cursor.execute(location_sql, (content_item_id,))
            base["location"] = cursor.fetchone()

            cursor.execute(operational_sql, (content_item_id,))
            base["operational_details"] = cursor.fetchone()

            cursor.execute(media_sql, (content_item_id,))
            base["media"] = cursor.fetchall()

        return base

    def create_content_item(self, payload: dict[str, Any], created_by_user_id: int) -> int:
        """Insert new content item and related tables in one transaction."""
        insert_sql = """
            INSERT INTO content_items (
                content_type_id,
                title,
                short_description,
                full_description,
                status_id,
                audience_notes,
                is_featured,
                is_active,
                created_by_user_id,
                approved_by_user_id,
                published_at
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """

        values = (
            payload["content_type_id"],
            payload["title"],
            payload.get("short_description"),
            payload.get("full_description"),
            payload["status_id"],
            payload.get("audience_notes"),
            1 if payload.get("is_featured") else 0,
            1 if payload.get("is_active", True) else 0,
            created_by_user_id,
            payload.get("approved_by_user_id"),
            payload.get("published_at"),
        )

        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute(insert_sql, values)
                content_item_id = int(cursor.lastrowid)

                location_id = payload.get("location_id")
                location_data = payload.get("location_data") or {}
                if location_data and str(location_data.get("area_id") or "").isdigit():
                    location_id = self._upsert_location(cursor, location_id, location_data)

                self._replace_categories(cursor, content_item_id, payload.get("category_ids") or [])
                self._replace_primary_location(cursor, content_item_id, location_id)
                self._upsert_operational_details(cursor, content_item_id, payload.get("operational_details") or {})
                self._apply_media_changes(
                    cursor,
                    content_item_id,
                    payload.get("media_to_add") or [],
                    payload.get("media_to_remove") or [],
                    created_by_user_id,
                )

                conn.commit()
                return content_item_id
            except Error:
                conn.rollback()
                raise

    def update_content_item(self, content_item_id: int, payload: dict[str, Any], approved_by_user_id: int | None) -> bool:
        """Update content item and related mappings in one transaction."""
        update_sql = """
            UPDATE content_items
            SET
                content_type_id = %s,
                title = %s,
                short_description = %s,
                full_description = %s,
                status_id = %s,
                audience_notes = %s,
                is_featured = %s,
                is_active = %s,
                approved_by_user_id = %s,
                published_at = %s
            WHERE id = %s
        """

        values = (
            payload["content_type_id"],
            payload["title"],
            payload.get("short_description"),
            payload.get("full_description"),
            payload["status_id"],
            payload.get("audience_notes"),
            1 if payload.get("is_featured") else 0,
            1 if payload.get("is_active", True) else 0,
            approved_by_user_id,
            payload.get("published_at"),
            content_item_id,
        )

        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute(update_sql, values)
                if cursor.rowcount == 0:
                    conn.rollback()
                    return False

                location_id = payload.get("location_id")
                location_data = payload.get("location_data") or {}
                if location_data and str(location_data.get("area_id") or "").isdigit():
                    location_id = self._upsert_location(cursor, location_id, location_data)

                self._replace_categories(cursor, content_item_id, payload.get("category_ids") or [])
                self._replace_primary_location(cursor, content_item_id, location_id)
                self._upsert_operational_details(cursor, content_item_id, payload.get("operational_details") or {})
                self._apply_media_changes(
                    cursor,
                    content_item_id,
                    payload.get("media_to_add") or [],
                    payload.get("media_to_remove") or [],
                    approved_by_user_id,
                )

                conn.commit()
                return True
            except Error:
                conn.rollback()
                raise

    def patch_content_item_status(self, content_item_id: int, status_id: int, is_active: bool | None, changed_by_user_id: int) -> bool:
        """Update status/active flags and append status-history row."""
        select_old_status_sql = "SELECT status_id FROM content_items WHERE id = %s LIMIT 1"

        if is_active is None:
            update_sql = "UPDATE content_items SET status_id = %s WHERE id = %s"
            update_params = (status_id, content_item_id)
        else:
            update_sql = "UPDATE content_items SET status_id = %s, is_active = %s WHERE id = %s"
            update_params = (status_id, 1 if is_active else 0, content_item_id)

        history_sql = """
            INSERT INTO content_status_history (
                content_item_id,
                old_status_id,
                new_status_id,
                changed_by_user_id,
                notes
            )
            VALUES (%s, %s, %s, %s, %s)
        """

        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute(select_old_status_sql, (content_item_id,))
                old_row = cursor.fetchone()
                if not old_row:
                    return False

                old_status_id = old_row["status_id"]
                cursor.execute(update_sql, update_params)
                if cursor.rowcount == 0:
                    conn.rollback()
                    return False

                cursor.execute(
                    history_sql,
                    (
                        content_item_id,
                        old_status_id,
                        status_id,
                        changed_by_user_id,
                        "Patched via admin API",
                    ),
                )
                conn.commit()
                return True
            except Error:
                conn.rollback()
                raise

    def get_admin_metadata(self) -> dict[str, list[dict[str, Any]]]:
        """Return lookup lists used by admin create/edit forms."""
        sql_map = {
            "categories": "SELECT id, name, color_code FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC",
            "statuses": "SELECT id, code, name FROM content_item_statuses WHERE is_active = 1 ORDER BY sort_order ASC, name ASC",
            "areas": "SELECT id, name FROM regions ORDER BY sort_order ASC, name ASC",
            "cities": "SELECT id, region_id AS area_id, name FROM cities ORDER BY name ASC",
            "locations": """
                SELECT
                    l.id,
                    l.region_id AS area_id,
                    l.city_id,
                    l.place_name,
                    l.address_line
                FROM locations l
                ORDER BY l.place_name ASC, l.id ASC
            """,
            "content_types": "SELECT id, code, name FROM content_types ORDER BY name ASC",
            "audiences": "SELECT id, name FROM audience_types ORDER BY sort_order ASC, name ASC",
        }

        output: dict[str, list[dict[str, Any]]] = {}
        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            for key, sql in sql_map.items():
                cursor.execute(sql)
                output[key] = cursor.fetchall()
        return output

    def is_valid_id_in_table(self, table_name: str, entity_id: int) -> bool:
        """Whitelist-based generic FK existence check."""
        allowed_tables = {
            "content_types",
            "content_item_statuses",
            "categories",
            "locations",
            "regions",
            "cities",
            "media_files",
            "users",
        }
        if table_name not in allowed_tables:
            return False

        sql = f"SELECT 1 FROM {table_name} WHERE id = %s LIMIT 1"
        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(sql, (entity_id,))
            return cursor.fetchone() is not None

    @staticmethod
    def _build_list_sort(sort_by: str | None) -> str:
        sort_key = (sort_by or "updated_desc").strip().lower()
        if sort_key == "created_desc":
            return "ci.created_at DESC, ci.id DESC"
        if sort_key == "title_asc":
            return "ci.title ASC, ci.id ASC"
        if sort_key == "title_desc":
            return "ci.title DESC, ci.id DESC"
        if sort_key == "status_asc":
            return "cis.name ASC, ci.updated_at DESC, ci.id DESC"
        return "ci.updated_at DESC, ci.id DESC"

    def _build_list_where(self, filters: dict[str, Any]) -> tuple[str, list[Any]]:
        clauses: list[str] = ["WHERE 1 = 1"]
        params: list[Any] = []

        q = (filters.get("q") or "").strip()
        if q:
            like = f"%{q}%"
            clauses.append("AND (ci.title LIKE %s OR ci.short_description LIKE %s OR ci.full_description LIKE %s)")
            params.extend([like, like, like])

        status_ids_raw = filters.get("status_ids")
        status_ids: list[int] = []

        if isinstance(status_ids_raw, str):
            status_ids = [int(value.strip()) for value in status_ids_raw.split(",") if value.strip().isdigit()]
        elif isinstance(status_ids_raw, (list, tuple)):
            status_ids = [int(value) for value in status_ids_raw if str(value).isdigit()]

        if status_ids:
            placeholders = self._build_in_clause(status_ids)
            clauses.append(f"AND ci.status_id IN ({placeholders})")
            params.extend(status_ids)
        else:
            status_id = filters.get("status_id")
            if str(status_id).isdigit():
                clauses.append("AND ci.status_id = %s")
                params.append(int(status_id))

        category_ids_raw = filters.get("category_ids")
        category_ids: list[int] = []
        if isinstance(category_ids_raw, str):
            category_ids = [int(value.strip()) for value in category_ids_raw.split(",") if value.strip().isdigit()]
        elif isinstance(category_ids_raw, (list, tuple)):
            category_ids = [int(value) for value in category_ids_raw if str(value).isdigit()]

        if category_ids:
            placeholders = self._build_in_clause(category_ids)
            clauses.append(
                f"""
                AND EXISTS (
                    SELECT 1
                    FROM content_categories cc
                    WHERE cc.content_item_id = ci.id
                      AND cc.category_id IN ({placeholders})
                )
                """
            )
            params.extend(category_ids)
        else:
            category_id = filters.get("category_id")
            if str(category_id).isdigit():
                clauses.append(
                    """
                    AND EXISTS (
                        SELECT 1
                        FROM content_categories cc
                        WHERE cc.content_item_id = ci.id
                          AND cc.category_id = %s
                    )
                    """
                )
                params.append(int(category_id))

        city_ids_raw = filters.get("city_ids")
        city_ids: list[int] = []
        if isinstance(city_ids_raw, str):
            city_ids = [int(value.strip()) for value in city_ids_raw.split(",") if value.strip().isdigit()]
        elif isinstance(city_ids_raw, (list, tuple)):
            city_ids = [int(value) for value in city_ids_raw if str(value).isdigit()]

        if city_ids:
            placeholders = self._build_in_clause(city_ids)
            clauses.append(
                f"""
                AND EXISTS (
                    SELECT 1
                    FROM content_locations cl_city
                    JOIN locations l_city ON l_city.id = cl_city.location_id
                    WHERE cl_city.content_item_id = ci.id
                      AND l_city.city_id IN ({placeholders})
                )
                """
            )
            params.extend(city_ids)
        else:
            city_id = filters.get("city_id")
            if str(city_id).isdigit():
                clauses.append(
                    """
                    AND EXISTS (
                        SELECT 1
                        FROM content_locations cl_city
                        JOIN locations l_city ON l_city.id = cl_city.location_id
                        WHERE cl_city.content_item_id = ci.id
                          AND l_city.city_id = %s
                    )
                    """
                )
                params.append(int(city_id))

        area_ids_raw = filters.get("area_ids")
        area_ids: list[int] = []
        if isinstance(area_ids_raw, str):
            area_ids = [int(value.strip()) for value in area_ids_raw.split(",") if value.strip().isdigit()]
        elif isinstance(area_ids_raw, (list, tuple)):
            area_ids = [int(value) for value in area_ids_raw if str(value).isdigit()]

        if area_ids:
            placeholders = self._build_in_clause(area_ids)
            clauses.append(
                f"""
                AND EXISTS (
                    SELECT 1
                    FROM content_locations cl_area
                    JOIN locations l_area ON l_area.id = cl_area.location_id
                    WHERE cl_area.content_item_id = ci.id
                      AND l_area.region_id IN ({placeholders})
                )
                """
            )
            params.extend(area_ids)
        else:
            area_id = filters.get("area_id")
            if str(area_id).isdigit():
                clauses.append(
                    """
                    AND EXISTS (
                        SELECT 1
                        FROM content_locations cl_area
                        JOIN locations l_area ON l_area.id = cl_area.location_id
                        WHERE cl_area.content_item_id = ci.id
                          AND l_area.region_id = %s
                    )
                    """
                )
                params.append(int(area_id))

        is_active_values_raw = filters.get("is_active_values")
        is_active_values: list[int] = []

        raw_active_values: list[Any] = []
        if isinstance(is_active_values_raw, str):
            raw_active_values = [value.strip() for value in is_active_values_raw.split(",") if value.strip()]
        elif isinstance(is_active_values_raw, (list, tuple)):
            raw_active_values = list(is_active_values_raw)

        for value in raw_active_values:
            normalized = str(value).strip().lower()
            if normalized in {"1", "true"}:
                is_active_values.append(1)
            elif normalized in {"0", "false"}:
                is_active_values.append(0)

        is_active_values = list(dict.fromkeys(is_active_values))
        if len(is_active_values) == 1:
            clauses.append("AND ci.is_active = %s")
            params.append(is_active_values[0])
        elif len(is_active_values) == 0:
            is_active = filters.get("is_active")
            if is_active in (0, 1, "0", "1", "true", "false", True, False):
                clauses.append("AND ci.is_active = %s")
                params.append(1 if str(is_active).lower() in {"1", "true"} else 0)

        return "\n".join(clauses), params

    def _build_list_details_query(self, page_ids: list[int]) -> tuple[str, tuple[Any, ...]]:
        placeholders = self._build_in_clause(page_ids)

        sql = f"""
            SELECT
                ci.id,
                ci.title,
                ci.short_description,
                ci.status_id,
                cis.code AS status_code,
                cis.name AS status_name,
                ci.is_featured,
                ci.is_active,
                ci.created_at,
                ci.updated_at,
                cat.categories_blob,
                media.primary_image_url,
                loc.area,
                loc.city
            FROM content_items ci
            JOIN content_item_statuses cis ON cis.id = ci.status_id
            LEFT JOIN (
                SELECT
                    cc.content_item_id,
                    GROUP_CONCAT(
                        CONCAT(c.id, '::', c.name, '::', IFNULL(c.color_code, ''))
                        ORDER BY cc.priority ASC, c.id ASC
                        SEPARATOR '||'
                    ) AS categories_blob
                FROM content_categories cc
                JOIN categories c ON c.id = cc.category_id
                GROUP BY cc.content_item_id
            ) cat ON cat.content_item_id = ci.id
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
                    c.name AS city
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
            WHERE ci.id IN ({placeholders})
            ORDER BY FIELD(ci.id, {placeholders})
        """

        params = tuple(page_ids + page_ids)
        return sql, params

    def _apply_media_changes(
        self,
        cursor,
        content_item_id: int,
        to_add: list,
        to_remove: list,
        uploaded_by_user_id: int | None,
    ) -> None:
        """Remove deleted media entries and insert newly added ones."""
        _MIME_MAP = {
            "jpg": "image/jpeg",
            "jpeg": "image/jpeg",
            "png": "image/png",
            "gif": "image/gif",
            "webp": "image/webp",
        }

        # -- Remove --
        safe_remove_ids = [int(mid) for mid in to_remove if str(mid).isdigit()]
        for media_file_id in safe_remove_ids:
            cursor.execute(
                "DELETE FROM content_media WHERE content_item_id = %s AND media_file_id = %s",
                (content_item_id, media_file_id),
            )
            # Delete the media_files row only when no other content references it.
            cursor.execute(
                "SELECT COUNT(*) AS cnt FROM content_media WHERE media_file_id = %s",
                (media_file_id,),
            )
            ref_row = cursor.fetchone()
            if (ref_row["cnt"] if isinstance(ref_row, dict) else ref_row[0]) == 0:
                cursor.execute("DELETE FROM media_files WHERE id = %s", (media_file_id,))

        # -- Add --
        for idx, item in enumerate(to_add):
            file_url = str(item.get("file_url") or "").strip()
            if not file_url:
                continue

            file_name = file_url.rsplit("/", 1)[-1] if "/" in file_url else file_url
            ext = file_url.rsplit(".", 1)[-1].lower() if "." in file_url else ""
            mime_type = _MIME_MAP.get(ext, "image/jpeg")
            alt_text = str(item.get("alt_text") or "").strip() or None
            is_primary = 1 if item.get("is_primary") else 0

            cursor.execute(
                """
                INSERT INTO media_files (file_name, file_url, mime_type, alt_text, uploaded_by_user_id)
                VALUES (%s, %s, %s, %s, %s)
                """,
                (file_name, file_url, mime_type, alt_text, uploaded_by_user_id),
            )
            new_media_file_id = int(cursor.lastrowid)

            if is_primary:
                # Demote any existing primary for this content item.
                cursor.execute(
                    "UPDATE content_media SET is_primary = 0 WHERE content_item_id = %s",
                    (content_item_id,),
                )

            cursor.execute(
                """
                INSERT INTO content_media (content_item_id, media_file_id, media_type, is_primary, sort_order)
                VALUES (%s, %s, 'image', %s, %s)
                ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary), sort_order = VALUES(sort_order)
                """,
                (content_item_id, new_media_file_id, is_primary, idx),
            )

    def _replace_categories(self, cursor, content_item_id: int, category_ids: list[int]) -> None:
        cursor.execute("DELETE FROM content_categories WHERE content_item_id = %s", (content_item_id,))

        cleaned_ids = [int(category_id) for category_id in category_ids if str(category_id).isdigit()]
        if not cleaned_ids:
            return

        insert_sql = """
            INSERT INTO content_categories (content_item_id, category_id, priority)
            VALUES (%s, %s, %s)
        """

        for index, category_id in enumerate(cleaned_ids, start=1):
            cursor.execute(insert_sql, (content_item_id, category_id, index))

    def _upsert_location(self, cursor, location_id: Any, location_data: dict[str, Any]) -> int:
        area_id = int(location_data["area_id"])

        city_id = location_data.get("city_id")
        city_id = int(city_id) if str(city_id).isdigit() else None

        place_name = str(location_data.get("place_name") or "").strip() or "מיקום"
        address_line = str(location_data.get("address_line") or "").strip() or None
        latitude = location_data.get("latitude")
        longitude = location_data.get("longitude")

        if str(location_id).isdigit():
            cursor.execute(
                """
                UPDATE locations
                SET region_id = %s,
                    city_id = %s,
                    place_name = %s,
                    address_line = %s,
                    latitude = %s,
                    longitude = %s
                WHERE id = %s
                """,
                (area_id, city_id, place_name, address_line, latitude, longitude, int(location_id)),
            )
            return int(location_id)

        cursor.execute(
            """
            INSERT INTO locations (region_id, city_id, place_name, address_line, latitude, longitude)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            (area_id, city_id, place_name, address_line, latitude, longitude),
        )
        return int(cursor.lastrowid)

    def _replace_primary_location(self, cursor, content_item_id: int, location_id: Any) -> None:
        cursor.execute("DELETE FROM content_locations WHERE content_item_id = %s", (content_item_id,))
        if not str(location_id).isdigit():
            return

        cursor.execute(
            """
            INSERT INTO content_locations (content_item_id, location_id, is_primary)
            VALUES (%s, %s, 1)
            """,
            (content_item_id, int(location_id)),
        )

    def _replace_primary_media(self, cursor, content_item_id: int, media_file_id: Any) -> None:
        if media_file_id is None:
            return

        cursor.execute(
            "UPDATE content_media SET is_primary = 0 WHERE content_item_id = %s",
            (content_item_id,),
        )

        if not str(media_file_id).isdigit():
            return

        cursor.execute(
            """
            INSERT INTO content_media (content_item_id, media_file_id, media_type, is_primary, sort_order)
            VALUES (%s, %s, 'image', 1, 0)
            ON DUPLICATE KEY UPDATE is_primary = VALUES(is_primary)
            """,
            (content_item_id, int(media_file_id)),
        )

    def _upsert_operational_details(self, cursor, content_item_id: int, details: dict[str, Any]) -> None:
        if not details:
            return

        sql = """
            INSERT INTO content_operational_details (
                content_item_id,
                duration_minutes,
                min_participants,
                max_participants,
                price_type,
                price_min,
                price_max,
                currency,
                booking_required,
                security_benefit_available,
                security_benefit_notes,
                website_url,
                booking_url,
                phone,
                email
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON DUPLICATE KEY UPDATE
                duration_minutes = VALUES(duration_minutes),
                min_participants = VALUES(min_participants),
                max_participants = VALUES(max_participants),
                price_type = VALUES(price_type),
                price_min = VALUES(price_min),
                price_max = VALUES(price_max),
                currency = VALUES(currency),
                booking_required = VALUES(booking_required),
                security_benefit_available = VALUES(security_benefit_available),
                security_benefit_notes = VALUES(security_benefit_notes),
                website_url = VALUES(website_url),
                booking_url = VALUES(booking_url),
                phone = VALUES(phone),
                email = VALUES(email)
        """

        values = (
            content_item_id,
            details.get("duration_minutes"),
            details.get("min_participants"),
            details.get("max_participants"),
            details.get("price_type"),
            details.get("price_min"),
            details.get("price_max"),
            details.get("currency") or "ILS",
            1 if details.get("booking_required") else 0,
            1 if details.get("security_benefit_available") else 0,
            details.get("security_benefit_notes"),
            details.get("website_url"),
            details.get("booking_url"),
            details.get("phone"),
            details.get("email"),
        )
        cursor.execute(sql, values)

