"""Repository queries for search endpoints."""

from __future__ import annotations

from typing import Any

try:
    # Works when backend/ is the active source root.
    from db import db_connection
except ImportError:
    # Works when workspace root is the active source root.
    from backend.db import db_connection


class SearchRepository:
    """Data access for search results and filter metadata."""

    @staticmethod
    def _execute_with_debug(cursor, sql: str, params: tuple[Any, ...] | None = None, label: str = "") -> None:
        """Execute SQL while printing query/params and detailed errors for debugging."""
        query_label = label or "query"
        print(f"\n[SQL] Running {query_label}")
        print(sql.strip())
        print(f"[SQL] Params: {params if params is not None else ()}")

        try:
            if params is None:
                cursor.execute(sql)
            else:
                cursor.execute(sql, params)
        except Exception as exc:
            print(f"[SQL] ERROR in {query_label}: {exc}")
            print("[SQL] Failed query:")
            print(sql.strip())
            print(f"[SQL] Failed params: {params if params is not None else ()}")
            raise

    def search(self, filters: dict[str, Any]) -> dict[str, Any]:
        """Return paginated search rows and total count using one filter definition."""
        where_sql, where_params = self._build_where_clause(filters)
        sort_sql = self._build_sort_clause(filters.get("sort_by", "recommended"))

        page = int(filters.get("page", 1))
        page_size = int(filters.get("page_size", 12))
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
            LEFT JOIN (
                SELECT f.content_item_id, COUNT(*) AS popularity_count
                FROM favorites f
                GROUP BY f.content_item_id
            ) pop ON pop.content_item_id = ci.id
            LEFT JOIN (
                SELECT
                    ranked.content_item_id,
                    l.latitude
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
                WHERE ranked.rn = 1
            ) loc_sort ON loc_sort.content_item_id = ci.id
            {where_sql}
            ORDER BY {sort_sql}
            LIMIT %s OFFSET %s
        """

        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)

            self._execute_with_debug(
                cursor,
                count_sql,
                tuple(where_params),
                label="search.count_sql",
            )
            total_count = int(cursor.fetchone()["total_count"])

            ids_params = tuple(where_params) + (page_size, offset)
            self._execute_with_debug(
                cursor,
                ids_sql,
                ids_params,
                label="search.ids_sql",
            )
            page_ids = [row["id"] for row in cursor.fetchall()]

            if not page_ids:
                return {
                    "total_count": total_count,
                    "page": page,
                    "page_size": page_size,
                    "rows": [],
                }

            details_sql, details_params = self._build_details_query(page_ids, filters.get("category_ids") or [])
            self._execute_with_debug(
                cursor,
                details_sql,
                details_params,
                label="search.details_sql",
            )
            rows = cursor.fetchall()

            return {
                "total_count": total_count,
                "page": page,
                "page_size": page_size,
                "rows": rows,
            }

    def get_filters_metadata(self) -> dict[str, list[dict[str, Any]]]:
        """Return dropdown-friendly metadata lists for the search page."""
        sql_map = {
            "areas": "SELECT id, name FROM regions ORDER BY sort_order ASC, name ASC",
            "cities": "SELECT id, region_id, name FROM cities ORDER BY name ASC",
            "statuses": "SELECT id, code, name FROM content_item_statuses WHERE is_active = 1 ORDER BY sort_order ASC, name ASC",
            "activity_types": "SELECT id, code, name FROM content_types ORDER BY name ASC",
            "categories": "SELECT id, parent_id, name, slug, color_code FROM categories WHERE is_active = 1 ORDER BY sort_order ASC, name ASC",
            # V1 assumption: age groups are represented through audience_types.
            "age_groups": "SELECT id, name FROM audience_types ORDER BY sort_order ASC, name ASC",
            "audience_types": "SELECT id, name FROM audience_types ORDER BY sort_order ASC, name ASC",
            "time_of_day": "SELECT id, code, name FROM time_of_day_options ORDER BY sort_order ASC, name ASC",
        }

        result: dict[str, list[dict[str, Any]]] = {}
        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            for key, sql in sql_map.items():
                self._execute_with_debug(cursor, sql, label=f"filters.{key}")
                result[key] = cursor.fetchall()
        return result

    @staticmethod
    def _build_in_clause(values: list[Any]) -> str:
        return ", ".join(["%s"] * len(values))

    def _build_where_clause(self, filters: dict[str, Any]) -> tuple[str, list[Any]]:
        clauses: list[str] = ["WHERE ci.is_active = 1", "AND cis.code = 'published'"]
        params: list[Any] = []

        text_query = (filters.get("q") or "").strip()
        if text_query:
            like_value = f"%{text_query}%"
            clauses.append(
                """
                AND (
                    ci.title LIKE %s
                    OR ci.short_description LIKE %s
                    OR ci.full_description LIKE %s
                    OR ci.audience_notes LIKE %s
                    OR EXISTS (
                        SELECT 1
                        FROM content_categories cc_q
                        JOIN categories c_q ON c_q.id = cc_q.category_id
                        WHERE cc_q.content_item_id = ci.id
                          AND c_q.name LIKE %s
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM content_tags ct_q
                        JOIN tags t_q ON t_q.id = ct_q.tag_id
                        WHERE ct_q.content_item_id = ci.id
                          AND t_q.name LIKE %s
                    )
                    OR EXISTS (
                        SELECT 1
                        FROM content_locations cl_q
                        JOIN locations l_q ON l_q.id = cl_q.location_id
                        WHERE cl_q.content_item_id = ci.id
                          AND (
                              l_q.place_name LIKE %s
                              OR l_q.address_line LIKE %s
                          )
                    )
                )
                """
            )
            params.extend([like_value] * 8)

        category_ids = [int(v) for v in (filters.get("category_ids") or []) if str(v).isdigit()]
        if category_ids:
            placeholders = self._build_in_clause(category_ids)
            clauses.append(
                f"""
                AND EXISTS (
                    SELECT 1
                    FROM content_categories cc_f
                    WHERE cc_f.content_item_id = ci.id
                      AND cc_f.category_id IN ({placeholders})
                )
                """
            )
            params.extend(category_ids)

        audience_ids = [int(v) for v in (filters.get("audience_ids") or []) if str(v).isdigit()]
        if audience_ids:
            placeholders = self._build_in_clause(audience_ids)
            clauses.append(
                f"""
                AND EXISTS (
                    SELECT 1
                    FROM content_audiences ca
                    WHERE ca.content_item_id = ci.id
                      AND ca.audience_type_id IN ({placeholders})
                )
                """
            )
            params.extend(audience_ids)

        day_of_week = filters.get("day_of_week")
        if str(day_of_week).isdigit():
            clauses.append(
                """
                AND EXISTS (
                    SELECT 1
                    FROM opening_hours oh
                    WHERE oh.content_item_id = ci.id
                      AND oh.day_of_week = %s
                )
                """
            )
            params.append(int(day_of_week))

        time_of_day = filters.get("time_of_day")
        if time_of_day is not None:
            if str(time_of_day).isdigit():
                clauses.append(
                    """
                    AND EXISTS (
                        SELECT 1
                        FROM content_time_of_day ctd
                        WHERE ctd.content_item_id = ci.id
                          AND ctd.time_of_day_id = %s
                    )
                    """
                )
                params.append(int(time_of_day))
            else:
                clauses.append(
                    """
                    AND EXISTS (
                        SELECT 1
                        FROM content_time_of_day ctd
                        JOIN time_of_day_options tdo ON tdo.id = ctd.time_of_day_id
                        WHERE ctd.content_item_id = ci.id
                          AND (tdo.code = %s OR tdo.name = %s)
                    )
                    """
                )
                params.extend([str(time_of_day), str(time_of_day)])

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

        region = filters.get("region")
        if region:
            if str(region).isdigit():
                clauses.append(
                    """
                    AND EXISTS (
                        SELECT 1
                        FROM content_locations cl_region
                        JOIN locations l_region ON l_region.id = cl_region.location_id
                        WHERE cl_region.content_item_id = ci.id
                          AND l_region.region_id = %s
                    )
                    """
                )
                params.append(int(region))
            else:
                clauses.append(
                    """
                    AND EXISTS (
                        SELECT 1
                        FROM content_locations cl_region
                        JOIN locations l_region ON l_region.id = cl_region.location_id
                        JOIN regions r_region ON r_region.id = l_region.region_id
                        WHERE cl_region.content_item_id = ci.id
                          AND r_region.name = %s
                    )
                    """
                )
                params.append(str(region))

        city = filters.get("city")
        if city:
            if str(city).isdigit():
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
                params.append(int(city))
            else:
                clauses.append(
                    """
                    AND EXISTS (
                        SELECT 1
                        FROM content_locations cl_city
                        JOIN locations l_city ON l_city.id = cl_city.location_id
                        JOIN cities c_city ON c_city.id = l_city.city_id
                        WHERE cl_city.content_item_id = ci.id
                          AND c_city.name = %s
                    )
                    """
                )
                params.append(str(city))

        age_group = (filters.get("age_group") or "").strip()
        if age_group:
            clauses.append("AND ci.audience_notes LIKE %s")
            params.append(f"%{age_group}%")

        activity_type = filters.get("activity_type")
        if activity_type:
            if str(activity_type).isdigit():
                clauses.append("AND ct.id = %s")
                params.append(int(activity_type))
            else:
                clauses.append("AND ct.code = %s")
                params.append(str(activity_type))

        # Keep published-only behavior for public search, but allow explicit published status value.
        status = (filters.get("status") or "").strip()
        if status and status.lower() != "published":
            clauses.append("AND 1 = 0")

        return "\n".join(clauses), params

    @staticmethod
    def _build_sort_clause(sort_by: str) -> str:
        sort_key = (sort_by or "recommended").strip().lower()
        if sort_key == "newest":
            return "ci.published_at DESC, ci.id DESC"
        if sort_key == "popular":
            return "COALESCE(pop.popularity_count, 0) DESC, ci.published_at DESC, ci.id DESC"
        if sort_key == "closest":
            return "CASE WHEN loc_sort.latitude IS NULL THEN 1 ELSE 0 END ASC, loc_sort.latitude DESC, ci.published_at DESC, ci.id DESC"
        if sort_key == "south_to_north":
            return "CASE WHEN loc_sort.latitude IS NULL THEN 1 ELSE 0 END ASC, loc_sort.latitude ASC, ci.published_at DESC, ci.id DESC"
        # recommended (default)
        return "ci.is_featured DESC, ci.published_at DESC, ci.id DESC"

    def _build_details_query(self, page_ids: list[int], category_filter_ids: list[Any]) -> tuple[str, tuple[Any, ...]]:
        id_placeholders = self._build_in_clause(page_ids)

        matched_join_sql = "LEFT JOIN (SELECT NULL AS content_item_id, NULL AS matched_marker_color) top_matched ON 1 = 0"
        matched_params: list[Any] = []

        valid_matched_ids = [int(v) for v in category_filter_ids if str(v).isdigit()]
        if valid_matched_ids:
            matched_placeholders = self._build_in_clause(valid_matched_ids)
            matched_join_sql = f"""
                LEFT JOIN (
                    SELECT ranked.content_item_id, ranked.color_code AS matched_marker_color
                    FROM (
                        SELECT
                            cc.content_item_id,
                            c.color_code,
                            ROW_NUMBER() OVER (
                                PARTITION BY cc.content_item_id
                                ORDER BY cc.priority ASC, cc.category_id ASC
                            ) AS rn
                        FROM content_categories cc
                        JOIN categories c ON c.id = cc.category_id
                        WHERE cc.category_id IN ({matched_placeholders})
                    ) ranked
                    WHERE ranked.rn = 1
                ) top_matched ON top_matched.content_item_id = ci.id
            """
            matched_params.extend(valid_matched_ids)

        sql = f"""
            SELECT
                ci.id,
                ci.title,
                ci.short_description,
                ci.full_description,
                ci.is_featured,
                ci.published_at,
                ci.audience_notes,
                ct.code AS activity_type,
                cis.name AS status_text,
                media.primary_image_url,
                loc.area,
                loc.city,
                loc.latitude,
                loc.longitude,
                op.min_participants,
                op.max_participants,
                op.price_type,
                op.price_min,
                op.price_max,
                op.currency,
                sched.opening_days,
                tod.time_of_day_names,
                cat.categories_blob,
                tags.tags_blob,
                top_all.default_marker_color,
                top_matched.matched_marker_color
            FROM content_items ci
            JOIN content_item_statuses cis ON cis.id = ci.status_id
            JOIN content_types ct ON ct.id = ci.content_type_id
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
                LEFT JOIN cities c ON c.id = l.city_id
                WHERE ranked.rn = 1
            ) loc ON loc.content_item_id = ci.id
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
                SELECT
                    ct.content_item_id,
                    GROUP_CONCAT(CONCAT(t.id, '::', t.name) ORDER BY t.id ASC SEPARATOR '||') AS tags_blob
                FROM content_tags ct
                JOIN tags t ON t.id = ct.tag_id
                GROUP BY ct.content_item_id
            ) tags ON tags.content_item_id = ci.id
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
            LEFT JOIN (
                SELECT ranked.content_item_id, ranked.color_code AS default_marker_color
                FROM (
                    SELECT
                        cc.content_item_id,
                        c.color_code,
                        ROW_NUMBER() OVER (
                            PARTITION BY cc.content_item_id
                            ORDER BY cc.priority ASC, cc.category_id ASC
                        ) AS rn
                    FROM content_categories cc
                    JOIN categories c ON c.id = cc.category_id
                ) ranked
                WHERE ranked.rn = 1
            ) top_all ON top_all.content_item_id = ci.id
            {matched_join_sql}
            WHERE ci.id IN ({id_placeholders})
            ORDER BY FIELD(ci.id, {id_placeholders})
        """

        params = tuple(matched_params + page_ids + page_ids)
        return sql, params




