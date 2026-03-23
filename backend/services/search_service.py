"""Service layer for search-page APIs."""

from __future__ import annotations

from typing import Any

try:
    # Works when backend/ is the active source root.
    from repositories.search_repository import SearchRepository
    from serializers.search_serializer import build_search_response_item
    from serializers.search_filters_serializer import build_search_filters_response
except ImportError:
    # Works when workspace root is the active source root.
    from backend.repositories.search_repository import SearchRepository
    from backend.serializers.search_serializer import build_search_response_item
    from backend.serializers.search_filters_serializer import build_search_filters_response


class SearchServiceError(Exception):
    """Raised when search service fails to process a request."""


class SearchService:
    """Coordinates search retrieval and response shaping."""

    def __init__(self, repository: SearchRepository | None = None):
        self._repository = repository or SearchRepository()

    def search(self, payload: dict[str, Any] | None) -> dict[str, Any]:
        """Run paginated search and return API-ready response structure."""
        filters = self._normalize_payload(payload or {})
        try:
            result = self._repository.search(filters)
            items = [build_search_response_item(row) for row in result["rows"]]
            return {
                "total_count": result["total_count"],
                "page": result["page"],
                "page_size": result["page_size"],
                "items": items,
            }
        except Exception as exc:
            raise SearchServiceError(f"Failed to run search: {exc}") from exc

    def get_filters_metadata(self) -> dict[str, list[dict[str, Any]]]:
        """Return metadata needed to build frontend filter controls."""
        try:
            raw = self._repository.get_filters_metadata()
            return build_search_filters_response(raw)
        except Exception as exc:
            raise SearchServiceError(f"Failed to load search filters metadata: {exc}") from exc

    @staticmethod
    def _normalize_payload(payload: dict[str, Any]) -> dict[str, Any]:
        """Normalize request payload to predictable types/defaults for SQL builder."""
        page = payload.get("page", 1)
        page_size = payload.get("page_size", 12)

        try:
            page = max(1, int(page))
        except (TypeError, ValueError):
            page = 1

        try:
            page_size = int(page_size)
        except (TypeError, ValueError):
            page_size = 12
        page_size = min(max(1, page_size), 50)

        category_ids = payload.get("category_ids") or []
        if not isinstance(category_ids, list):
            category_ids = [category_ids]

        audience_ids = payload.get("audience_ids") or []
        if not isinstance(audience_ids, list):
            audience_ids = [audience_ids]

        return {
            "q": payload.get("q"),
            "area_id": payload.get("area_id"),
            "region": payload.get("region"),
            "city": payload.get("city"),
            "age_group": payload.get("age_group"),
            "status": payload.get("status"),
            "activity_type": payload.get("activity_type"),
            "category_ids": category_ids,
            "audience_ids": audience_ids,
            "day_of_week": payload.get("day_of_week"),
            "time_of_day": payload.get("time_of_day"),
            "sort_by": payload.get("sort_by", "recommended"),
            "page": page,
            "page_size": page_size,
        }



