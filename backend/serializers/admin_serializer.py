"""Serializer helpers for admin content-management APIs."""

from __future__ import annotations

from typing import Any


def _split_blob(blob: str | None, item_sep: str = "||", field_sep: str = "::") -> list[list[str]]:
    if not blob:
        return []

    parsed: list[list[str]] = []
    for item in blob.split(item_sep):
        if not item:
            continue
        parsed.append(item.split(field_sep))
    return parsed


def serialize_admin_list_item(row: dict[str, Any]) -> dict[str, Any]:
    """Map a repository row to admin listing card/row shape."""
    categories: list[dict[str, Any]] = []
    for parts in _split_blob(row.get("categories_blob")):
        if len(parts) < 2:
            continue
        categories.append(
            {
                "id": int(parts[0]),
                "name": parts[1],
                "color": parts[2] if len(parts) > 2 else None,
            }
        )

    return {
        "id": row["id"],
        "title": row.get("title"),
        "short_description": row.get("short_description"),
        "status": {
            "id": row.get("status_id"),
            "code": row.get("status_code"),
            "name": row.get("status_name"),
        },
        "is_active": bool(row.get("is_active", 0)),
        "is_featured": bool(row.get("is_featured", 0)),
        "categories": categories,
        "location": {
            "area": row.get("area"),
            "city": row.get("city"),
        },
        "primary_image_url": row.get("primary_image_url"),
        "created_at": row.get("created_at"),
        "updated_at": row.get("updated_at"),
    }


def serialize_admin_item_details(raw: dict[str, Any]) -> dict[str, Any]:
    """Map full repository payload to edit-form friendly response shape."""
    return {
        "id": raw["id"],
        "content_type_id": raw.get("content_type_id"),
        "title": raw.get("title"),
        "short_description": raw.get("short_description"),
        "full_description": raw.get("full_description"),
        "audience_notes": raw.get("audience_notes"),
        "status": {
            "id": raw.get("status_id"),
            "code": raw.get("status_code"),
            "name": raw.get("status_name"),
        },
        "is_active": bool(raw.get("is_active", 0)),
        "is_featured": bool(raw.get("is_featured", 0)),
        "published_at": raw.get("published_at"),
        "created_at": raw.get("created_at"),
        "updated_at": raw.get("updated_at"),
        "categories": raw.get("categories", []),
        "location": raw.get("location"),
        "operational_details": raw.get("operational_details"),
        "media": raw.get("media", []),
    }

