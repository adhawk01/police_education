"""Serializer helpers for search filters metadata endpoint."""

from __future__ import annotations


# No dedicated lookup table exists for weekdays in schema.sql, so keep this temporary list isolated here.
_DAYS_OF_WEEK = [
    {"value": 1, "label": "Sunday"},
    {"value": 2, "label": "Monday"},
    {"value": 3, "label": "Tuesday"},
    {"value": 4, "label": "Wednesday"},
    {"value": 5, "label": "Thursday"},
    {"value": 6, "label": "Friday"},
    {"value": 7, "label": "Saturday"},
]


def build_search_filters_response(raw: dict) -> dict:
    """Transform raw repository metadata to a frontend-friendly payload shape."""
    areas = [
        {
            "id": row["id"],
            "name": row["name"],
        }
        for row in raw.get("areas", [])
    ]

    cities = [
        {
            "id": row["id"],
            "name": row["name"],
            "area_id": row.get("region_id"),
        }
        for row in raw.get("cities", [])
    ]

    statuses = [
        {
            "value": row.get("code"),
            "label": row.get("name"),
            "id": row.get("id"),
        }
        for row in raw.get("statuses", [])
    ]

    activity_types = [
        {
            "value": row.get("code"),
            "label": row.get("name"),
            "id": row.get("id"),
        }
        for row in raw.get("activity_types", [])
    ]

    categories = [
        {
            "id": row["id"],
            "name": row["name"],
            "color": row.get("color_code"),
            "parent_id": row.get("parent_id"),
            # Category-level priority is not defined in schema; priority exists per content-item mapping.
            "priority": None,
        }
        for row in raw.get("categories", [])
    ]

    age_groups = [
        {
            "value": row.get("id"),
            "label": row.get("name"),
        }
        for row in raw.get("age_groups", [])
    ]

    audience_types = [
        {
            "value": row.get("id"),
            "label": row.get("name"),
        }
        for row in raw.get("audience_types", [])
    ]

    time_of_day = [
        {
            "value": row.get("code") or row.get("id"),
            "label": row.get("name"),
            "id": row.get("id"),
        }
        for row in raw.get("time_of_day", [])
    ]

    return {
        "areas": areas,
        "cities": cities,
        "statuses": statuses,
        "activity_types": activity_types,
        "categories": categories,
        "age_groups": age_groups,
        "audience_types": audience_types,
        "days_of_week": _DAYS_OF_WEEK,
        "time_of_day": time_of_day,
    }

