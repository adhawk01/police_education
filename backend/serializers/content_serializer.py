"""Serializer helpers for content details API."""

from __future__ import annotations

from typing import Any


def _build_participants_text(min_participants: int | None, max_participants: int | None) -> str | None:
    if min_participants is None and max_participants is None:
        return None
    if min_participants is not None and max_participants is not None:
        return f"{min_participants}-{max_participants}"
    if min_participants is not None:
        return f"From {min_participants}"
    return f"Up to {max_participants}"


def _build_price_text(
    price_type: str | None,
    price_min: float | None,
    price_max: float | None,
    currency: str | None,
) -> str | None:
    if price_type:
        return price_type

    if price_min is None and price_max is None:
        return None

    cur = currency or "ILS"
    if price_min is not None and price_max is not None:
        if price_min == price_max:
            return f"{price_min:g} {cur}"
        return f"{price_min:g}-{price_max:g} {cur}"

    if price_min is not None:
        return f"From {price_min:g} {cur}"

    return f"Up to {price_max:g} {cur}"


def _build_schedule_text(opening_days: str | None, time_of_day_names: str | None) -> str | None:
    parts: list[str] = []
    if opening_days:
        parts.append(f"Days: {opening_days}")
    if time_of_day_names:
        parts.append(time_of_day_names)
    if not parts:
        return None
    return " | ".join(parts)


def _build_age_text(audience_notes: str | None, audience_types: list[dict[str, Any]]) -> str | None:
    if audience_notes:
        return audience_notes

    audience_names = [row.get("name") for row in audience_types if row.get("name")]
    if audience_names:
        return ", ".join(audience_names)
    return None


def build_content_item_details_response(raw: dict[str, Any]) -> dict[str, Any]:
    """Map repository output to content-details response contract."""
    categories = [
        {
            "id": row["id"],
            "name": row["name"],
            "color": row.get("color_code"),
            "priority": row.get("priority"),
        }
        for row in raw.get("categories", [])
    ]

    badges = [row["name"] for row in raw.get("tags", []) if row.get("name")]

    accessibility_features = [row["name"] for row in raw.get("accessibility_features", []) if row.get("name")]
    accessibility_notes = raw.get("accessibility_notes")
    has_accessibility_info = bool(accessibility_notes or accessibility_features)

    participants_text = _build_participants_text(
        raw.get("min_participants"),
        raw.get("max_participants"),
    )
    price_text = _build_price_text(
        raw.get("price_type"),
        raw.get("price_min"),
        raw.get("price_max"),
        raw.get("currency"),
    )
    schedule_text = _build_schedule_text(raw.get("opening_days"), raw.get("time_of_day_names"))
    age_text = _build_age_text(raw.get("audience_notes"), raw.get("audience_types", []))

    recommended_items = [
        {
            "id": row["id"],
            "title": row["title"],
            "image_url": row.get("image_url"),
            "short_description": row.get("short_description"),
        }
        for row in raw.get("recommended_items", [])
    ]

    return {
        "id": raw["id"],
        "title": raw["title"],
        "short_description": raw.get("short_description"),
        "full_description": raw.get("full_description"),
        "primary_image_url": raw.get("primary_image_url"),
        "gallery_images": raw.get("gallery_images", []),
        "categories": categories,
        "badges": badges,
        "location": {
            "area": raw.get("area"),
            "city": raw.get("city"),
            "address": raw.get("address"),
            "lat": raw.get("latitude"),
            "lng": raw.get("longitude"),
        },
        "details": {
            "price_text": price_text,
            "age_text": age_text,
            "participants_text": participants_text,
            "schedule_text": schedule_text,
            "activity_type": raw.get("activity_type_name") or raw.get("activity_type_code"),
            "status_text": raw.get("status_text"),
        },
        "accessibility": {
            "has_accessibility_info": has_accessibility_info,
            "text": accessibility_notes,
            "features": accessibility_features,
        },
        "contact": {
            "phone": raw.get("phone"),
            "email": raw.get("email"),
            "website": raw.get("website_url"),
            "booking_url": raw.get("booking_url"),
        },
        "recommended_items": recommended_items,
    }

