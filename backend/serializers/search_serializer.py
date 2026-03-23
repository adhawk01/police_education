"""Helpers to convert raw search rows to API response objects."""

from __future__ import annotations

from typing import Any


def _parse_kv_blob(blob: str | None, expected_parts: int = 3) -> list[list[str]]:
	"""Parse GROUP_CONCAT blobs with '||' item separator and '::' field separator."""
	if not blob:
		return []

	parsed: list[list[str]] = []
	for item in blob.split("||"):
		parts = item.split("::")
		if len(parts) < expected_parts:
			continue
		parsed.append(parts)
	return parsed


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


def _build_schedule_text(opening_days: str | None, time_of_day: str | None) -> str | None:
	parts: list[str] = []
	if opening_days:
		parts.append(f"Days: {opening_days}")
	if time_of_day:
		parts.append(time_of_day)
	if not parts:
		return None
	return " | ".join(parts)


def build_search_response_item(row: dict[str, Any]) -> dict[str, Any]:
	"""Convert a repository row into the search-card response contract."""
	category_parts = _parse_kv_blob(row.get("categories_blob"), expected_parts=3)
	categories = [
		{
			"id": int(parts[0]),
			"name": parts[1],
			"color_code": parts[2] or None,
		}
		for parts in category_parts
	]

	tag_parts = _parse_kv_blob(row.get("tags_blob"), expected_parts=2)
	badges = [{"id": int(parts[0]), "name": parts[1]} for parts in tag_parts]

	marker_color = row.get("matched_marker_color") or row.get("default_marker_color")

	return {
		"id": row["id"],
		"title": row["title"],
		"short_description": row.get("short_description"),
		"full_description": row.get("full_description"),
		"primary_image_url": row.get("primary_image_url"),
		"categories": categories,
		"badges": badges,
		"metadata": {
			"area": row.get("area"),
			"city": row.get("city"),
			"age_text": row.get("audience_notes"),
			"participants_text": _build_participants_text(
				row.get("min_participants"),
				row.get("max_participants"),
			),
			"price_text": _build_price_text(
				row.get("price_type"),
				row.get("price_min"),
				row.get("price_max"),
				row.get("currency"),
			),
			"status_text": row.get("status_text"),
			"schedule_text": _build_schedule_text(
				row.get("opening_days"),
				row.get("time_of_day_names"),
			),
		},
		"primary_category_color": marker_color,
		"marker_color": marker_color,
		"coordinates": {
			"latitude": row.get("latitude"),
			"longitude": row.get("longitude"),
		}
		if row.get("latitude") is not None and row.get("longitude") is not None
		else None,
		"is_featured": row.get("is_featured"),
		"activity_type": row.get("activity_type"),
		"published_at": row.get("published_at"),
	}

