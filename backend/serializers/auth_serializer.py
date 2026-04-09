"""Serializer helpers for authentication responses."""

from __future__ import annotations

from typing import Any


def serialize_user(user_row: dict[str, Any]) -> dict[str, Any]:
    """Return a safe user payload without sensitive fields."""
    role_codes_blob = user_row.get("role_codes_blob") or ""
    permission_codes_blob = user_row.get("permission_codes_blob") or ""

    roles = [code for code in role_codes_blob.split(",") if code]
    permissions = [code for code in permission_codes_blob.split(",") if code]

    return {
        "id": user_row["id"],
        "full_name": user_row["full_name"],
        "email": user_row["email"],
        "roles": roles,
        "permissions": permissions,
        "status": {
            "id": user_row.get("status_id"),
            "code": user_row.get("status_code"),
            "name": user_row.get("status_name"),
            "is_active": bool(user_row.get("status_is_active", 0)),
        },
    }

