"""Service layer for protected admin/site-manager content APIs."""

from __future__ import annotations

import json
from typing import Any
from urllib.error import URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from mysql.connector import Error

try:
    # Works when backend/ is the active source root.
    from repositories.admin_repository import AdminRepository
    from serializers.admin_serializer import serialize_admin_item_details, serialize_admin_list_item
except ImportError:
    # Works when workspace root is the active source root.
    from backend.repositories.admin_repository import AdminRepository
    from backend.serializers.admin_serializer import serialize_admin_item_details, serialize_admin_list_item


class AdminServiceError(Exception):
    """Base admin service exception."""


class AdminValidationError(AdminServiceError):
    """Raised when admin payload is invalid."""


class AdminNotFoundError(AdminServiceError):
    """Raised when requested content item does not exist."""


class AdminService:
    """Coordinates validation, repository calls, and response shaping for admin APIs."""

    def __init__(self, repository: AdminRepository | None = None):
        self._repository = repository or AdminRepository()

    def list_content_items(self, payload: dict[str, Any] | None) -> dict[str, Any]:
        filters = self._normalize_list_filters(payload or {})
        try:
            data = self._repository.list_content_items(filters)
            return {
                "total_count": data["total_count"],
                "page": data["page"],
                "page_size": data["page_size"],
                "items": [serialize_admin_list_item(row) for row in data["rows"]],
            }
        except Exception as exc:
            raise AdminServiceError(f"Failed to load admin content list: {exc}") from exc

    def get_content_item_for_edit(self, content_item_id: int) -> dict[str, Any]:
        if content_item_id <= 0:
            raise AdminNotFoundError("Content item not found")

        try:
            raw = self._repository.get_content_item_for_edit(content_item_id)
            if not raw:
                raise AdminNotFoundError("Content item not found")
            return serialize_admin_item_details(raw)
        except AdminNotFoundError:
            raise
        except Exception as exc:
            raise AdminServiceError(f"Failed to load content item: {exc}") from exc

    def create_content_item(self, payload: dict[str, Any], current_user_id: int) -> dict[str, Any]:
        normalized = self._normalize_write_payload(payload)
        self._validate_write_payload(normalized)
        self._attach_geo_coordinates(normalized)

        try:
            content_item_id = self._repository.create_content_item(normalized, current_user_id)
            created = self._repository.get_content_item_for_edit(content_item_id)
            if not created:
                raise AdminServiceError("Created content item could not be reloaded")
            return serialize_admin_item_details(created)
        except (AdminValidationError, AdminServiceError):
            raise
        except Error as exc:
            raise AdminServiceError(f"Failed to create content item: {exc}") from exc
        except Exception as exc:
            raise AdminServiceError(f"Failed to create content item: {exc}") from exc

    def update_content_item(self, content_item_id: int, payload: dict[str, Any], current_user_id: int) -> dict[str, Any]:
        if content_item_id <= 0:
            raise AdminNotFoundError("Content item not found")

        normalized = self._normalize_write_payload(payload)
        self._validate_write_payload(normalized)
        self._attach_geo_coordinates(normalized)

        try:
            updated = self._repository.update_content_item(content_item_id, normalized, current_user_id)
            if not updated:
                raise AdminNotFoundError("Content item not found")

            row = self._repository.get_content_item_for_edit(content_item_id)
            if not row:
                raise AdminNotFoundError("Content item not found")
            return serialize_admin_item_details(row)
        except (AdminNotFoundError, AdminValidationError):
            raise
        except Error as exc:
            raise AdminServiceError(f"Failed to update content item: {exc}") from exc
        except Exception as exc:
            raise AdminServiceError(f"Failed to update content item: {exc}") from exc

    def patch_status(self, content_item_id: int, payload: dict[str, Any], current_user_id: int) -> dict[str, Any]:
        if content_item_id <= 0:
            raise AdminNotFoundError("Content item not found")

        status_id = payload.get("status_id")
        if not str(status_id).isdigit():
            raise AdminValidationError("status_id is required and must be numeric")

        status_id = int(status_id)
        if not self._repository.is_valid_id_in_table("content_item_statuses", status_id):
            raise AdminValidationError("status_id is invalid")

        is_active = payload.get("is_active")
        if is_active is not None:
            if isinstance(is_active, str):
                if is_active.lower() in {"true", "1"}:
                    is_active = True
                elif is_active.lower() in {"false", "0"}:
                    is_active = False
                else:
                    raise AdminValidationError("is_active must be boolean")
            elif not isinstance(is_active, bool):
                raise AdminValidationError("is_active must be boolean")

        try:
            updated = self._repository.patch_content_item_status(content_item_id, status_id, is_active, current_user_id)
            if not updated:
                raise AdminNotFoundError("Content item not found")

            row = self._repository.get_content_item_for_edit(content_item_id)
            if not row:
                raise AdminNotFoundError("Content item not found")
            return serialize_admin_item_details(row)
        except (AdminNotFoundError, AdminValidationError):
            raise
        except Exception as exc:
            raise AdminServiceError(f"Failed to patch content item status: {exc}") from exc

    def deactivate_content_item(self, content_item_id: int, current_user_id: int) -> dict[str, Any]:
        """Safe delete behavior for v1: mark inactive and move to archived status."""
        archived_status = self._resolve_archived_status_id()
        return self.patch_status(
            content_item_id,
            {"status_id": archived_status, "is_active": False},
            current_user_id,
        )

    def get_admin_metadata(self) -> dict[str, list[dict[str, Any]]]:
        try:
            return self._repository.get_admin_metadata()
        except Exception as exc:
            raise AdminServiceError(f"Failed to load admin metadata: {exc}") from exc

    def _resolve_archived_status_id(self) -> int:
        metadata = self._repository.get_admin_metadata()
        statuses = metadata.get("statuses") or []
        for status in statuses:
            if str(status.get("code", "")).strip().lower() == "archived":
                return int(status["id"])
        raise AdminValidationError("Archived status is not configured")

    def _validate_write_payload(self, payload: dict[str, Any]) -> None:
        if not payload.get("title"):
            raise AdminValidationError("title is required")
        if not str(payload.get("content_type_id")).isdigit():
            raise AdminValidationError("content_type_id is required and must be numeric")
        if not str(payload.get("status_id")).isdigit():
            raise AdminValidationError("status_id is required and must be numeric")

        content_type_id = int(payload["content_type_id"])
        status_id = int(payload["status_id"])

        if not self._repository.is_valid_id_in_table("content_types", content_type_id):
            raise AdminValidationError("content_type_id is invalid")

        if not self._repository.is_valid_id_in_table("content_item_statuses", status_id):
            raise AdminValidationError("status_id is invalid")

        approved_by = payload.get("approved_by_user_id")
        if approved_by is not None:
            if not str(approved_by).isdigit() or not self._repository.is_valid_id_in_table("users", int(approved_by)):
                raise AdminValidationError("approved_by_user_id is invalid")

        location_id = payload.get("location_id")
        if location_id is not None:
            if not str(location_id).isdigit() or not self._repository.is_valid_id_in_table("locations", int(location_id)):
                raise AdminValidationError("location_id is invalid")

        location_data = payload.get("location_data") or {}
        if location_data:
            area_id = location_data.get("area_id")
            if not str(area_id).isdigit() or not self._repository.is_valid_id_in_table("regions", int(area_id)):
                raise AdminValidationError("area_id is required and must be valid when setting location data")

            city_id = location_data.get("city_id")
            if city_id is not None and str(city_id).strip() != "":
                if not str(city_id).isdigit() or not self._repository.is_valid_id_in_table("cities", int(city_id)):
                    raise AdminValidationError("city_id is invalid")

            address_line = str(location_data.get("address_line") or "").strip()
            if address_line and len(address_line) < 3:
                raise AdminValidationError("address_line is too short")

        media_id = payload.get("primary_media_file_id")
        if media_id is not None:
            if not str(media_id).isdigit() or not self._repository.is_valid_id_in_table("media_files", int(media_id)):
                raise AdminValidationError("primary_media_file_id is invalid")

        category_ids = payload.get("category_ids") or []
        for category_id in category_ids:
            if not str(category_id).isdigit() or not self._repository.is_valid_id_in_table("categories", int(category_id)):
                raise AdminValidationError("One or more category_ids are invalid")

    @staticmethod
    def _normalize_write_payload(payload: dict[str, Any]) -> dict[str, Any]:
        category_ids = payload.get("category_ids") or []
        if not isinstance(category_ids, list):
            category_ids = [category_ids]

        raw_location_data = payload.get("location_data") or {}
        if not isinstance(raw_location_data, dict):
            raw_location_data = {}

        location_data = {
            "area_id": raw_location_data.get("area_id"),
            "city_id": raw_location_data.get("city_id"),
            "place_name": (raw_location_data.get("place_name") or "").strip() or None,
            "address_line": (raw_location_data.get("address_line") or "").strip() or None,
        }

        return {
            "content_type_id": payload.get("content_type_id"),
            "title": (payload.get("title") or "").strip(),
            "short_description": payload.get("short_description"),
            "full_description": payload.get("full_description"),
            "status_id": payload.get("status_id"),
            "audience_notes": payload.get("audience_notes"),
            "is_featured": bool(payload.get("is_featured", False)),
            "is_active": bool(payload.get("is_active", True)),
            "approved_by_user_id": payload.get("approved_by_user_id"),
            "published_at": payload.get("published_at"),
            "category_ids": category_ids,
            "location_id": payload.get("location_id"),
            "location_data": location_data,
            "primary_media_file_id": payload.get("primary_media_file_id"),
            "operational_details": payload.get("operational_details") or {},
            "media_to_add": payload.get("media_to_add") or [],
            "media_to_remove": payload.get("media_to_remove") or [],
        }

    def _attach_geo_coordinates(self, payload: dict[str, Any]) -> None:
        location_data = payload.get("location_data") or {}
        address_line = str(location_data.get("address_line") or "").strip()
        if not address_line:
            return

        coordinates = self._geocode_address(address_line)
        if coordinates is None:
            raise AdminValidationError("לא ניתן לחשב קואורדינטות עבור הכתובת שסופקה")

        latitude, longitude = coordinates
        location_data["latitude"] = latitude
        location_data["longitude"] = longitude

    @staticmethod
    def _geocode_address(address_line: str) -> tuple[float, float] | None:
        """Resolve address to latitude/longitude via OpenStreetMap Nominatim."""
        query = urlencode({"q": address_line, "format": "json", "limit": 1})
        url = f"https://nominatim.openstreetmap.org/search?{query}"
        request = Request(url, headers={"User-Agent": "police-education-admin/1.0"})

        try:
            with urlopen(request, timeout=8) as response:
                data = json.loads(response.read().decode("utf-8"))
        except (URLError, TimeoutError, ValueError, json.JSONDecodeError):
            return None

        if not isinstance(data, list) or not data:
            return None

        first = data[0] or {}
        try:
            latitude = float(first.get("lat"))
            longitude = float(first.get("lon"))
            return latitude, longitude
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _normalize_list_filters(payload: dict[str, Any]) -> dict[str, Any]:
        page = payload.get("page", 1)
        page_size = payload.get("page_size", 20)

        try:
            page = max(1, int(page))
        except (TypeError, ValueError):
            page = 1

        try:
            page_size = int(page_size)
        except (TypeError, ValueError):
            page_size = 20
        page_size = min(max(1, page_size), 100)

        return {
            "q": payload.get("q"),
            "status_id": payload.get("status_id"),
            "status_ids": payload.get("status_ids"),
            "category_id": payload.get("category_id"),
            "category_ids": payload.get("category_ids"),
            "city_id": payload.get("city_id"),
            "city_ids": payload.get("city_ids"),
            "area_id": payload.get("area_id"),
            "area_ids": payload.get("area_ids"),
            "is_active": payload.get("is_active"),
            "is_active_values": payload.get("is_active_values"),
            "sort_by": payload.get("sort_by", "updated_desc"),
            "page": page,
            "page_size": page_size,
        }

