"""Repository queries for authentication flows."""

from __future__ import annotations

from typing import Any

from mysql.connector import Error

try:
    # Works when backend/ is the active source root.
    from db import db_connection
except ImportError:
    # Works when workspace root is the active source root.
    from backend.db import db_connection


class AuthRepository:
    """Database access for register/login/me authentication operations."""

    @staticmethod
    def _base_user_select() -> str:
        return """
            SELECT
                u.id,
                u.full_name,
                u.email,
                u.password_hash,
                u.status_id,
                us.code AS status_code,
                us.name AS status_name,
                us.is_active AS status_is_active,
                (
                    SELECT GROUP_CONCAT(DISTINCT r.code ORDER BY r.code SEPARATOR ',')
                    FROM user_roles ur
                    JOIN roles r ON r.id = ur.role_id
                    WHERE ur.user_id = u.id
                ) AS role_codes_blob,
                (
                    SELECT GROUP_CONCAT(DISTINCT p.code ORDER BY p.code SEPARATOR ',')
                    FROM user_roles urp
                    JOIN role_permissions rp ON rp.role_id = urp.role_id
                    JOIN permissions p ON p.id = rp.permission_id
                    WHERE urp.user_id = u.id
                ) AS permission_codes_blob
            FROM users u
            JOIN users_statuses us ON us.id = u.status_id
        """

    def get_user_by_email(self, email: str) -> dict[str, Any] | None:
        """Return user row by email including status fields."""
        sql = f"""
            {self._base_user_select()}
            WHERE u.email = %s
            LIMIT 1
        """
        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(sql, (email,))
            return cursor.fetchone()

    def get_user_by_id(self, user_id: int) -> dict[str, Any] | None:
        """Return user row by id including status fields."""
        sql = f"""
            {self._base_user_select()}
            WHERE u.id = %s
            LIMIT 1
        """
        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(sql, (user_id,))
            return cursor.fetchone()

    def get_default_active_status_id(self) -> int | None:
        """Resolve the status_id to use for self-registration."""
        sql_preferred = """
            SELECT id
            FROM users_statuses
            WHERE code = 'active' AND is_active = 1
            LIMIT 1
        """
        sql_fallback = """
            SELECT id
            FROM users_statuses
            WHERE is_active = 1
            ORDER BY sort_order ASC, id ASC
            LIMIT 1
        """

        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute(sql_preferred)
            row = cursor.fetchone()
            if row:
                return int(row["id"])

            cursor.execute(sql_fallback)
            row = cursor.fetchone()
            return int(row["id"]) if row else None

    def create_user(self, full_name: str, email: str, password_hash: str, status_id: int) -> dict[str, Any]:
        """Insert a new user and return the created user row."""
        insert_sql = """
            INSERT INTO users (
                full_name,
                email,
                password_hash,
                status_id
            )
            VALUES (%s, %s, %s, %s)
        """

        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            try:
                cursor.execute(insert_sql, (full_name, email, password_hash, status_id))
                conn.commit()
            except Error:
                conn.rollback()
                raise

            user_id = cursor.lastrowid

        created_user = self.get_user_by_id(int(user_id))
        if not created_user:
            raise RuntimeError("User was created but could not be reloaded")
        return created_user

