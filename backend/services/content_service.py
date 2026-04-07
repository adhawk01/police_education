"""Service layer for content details API."""

from __future__ import annotations

try:
    # Works when backend/ is the active source root.
    from repositories.content_repository import ContentRepository
    from serializers.content_serializer import build_content_item_details_response
except ImportError:
    # Works when workspace root is the active source root.
    from backend.repositories.content_repository import ContentRepository
    from backend.serializers.content_serializer import build_content_item_details_response


class ContentServiceError(Exception):
    """Base content service exception."""


class ContentNotFoundError(ContentServiceError):
    """Raised when content item is missing or not publicly visible."""


class ContentService:
    """Coordinates data retrieval for content details pages."""

    def __init__(self, repository: ContentRepository | None = None):
        self._repository = repository or ContentRepository()

    def get_content_item_details(self, content_item_id: int) -> dict:
        """Return full details response for one content item id."""
        if content_item_id <= 0:
            raise ContentNotFoundError("Content item not found")

        try:
            raw = self._repository.get_content_item_details(content_item_id)
            if not raw:
                raise ContentNotFoundError("Content item not found")
            return build_content_item_details_response(raw)
        except ContentNotFoundError:
            raise
        except Exception as exc:
            raise ContentServiceError(f"Failed to load content item details: {exc}") from exc

