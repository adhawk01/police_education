"""Business/application service for home page data."""

try:
    # Works when backend/ is the active source root.
    from repositories.home_repository import HomeRepository
except ImportError:
    # Works when workspace root is the active source root.
    from backend.repositories.home_repository import HomeRepository


class HomeServiceError(Exception):
    """Raised when HomeService cannot prepare home page data."""


class HomeService:
    """Orchestrates home-page data retrieval using HomeRepository."""

    def __init__(self, repository: HomeRepository | None = None):
        # Allow dependency injection for tests; default to real repository.
        self._repository = repository or HomeRepository()

    def get_home_page_data(self) -> dict:
        """
        Build and return the complete home-page payload.

        Returns:
            {
                "categories": [...],
                "featured_items": [...],
                "regions": [...],
                "content_types": [...]
            }

        Raises:
            HomeServiceError: if repository/data access fails.
        """
        try:
            return {
                "categories": self._repository.get_categories(),
                "featured_items": self._repository.get_featured_items(),
                "regions": self._repository.get_regions(),
                "content_types": self._repository.get_content_types(),
            }
        except Exception as exc:
            # Keep service errors consistent for API/controller layers.
            raise HomeServiceError(f"Failed to load home page data: {exc}") from exc

