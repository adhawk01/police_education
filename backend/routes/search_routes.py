"""Search page API routes."""

from flask import Blueprint, jsonify, request

try:
    # Works when backend/ is the active source root.
    from services.search_service import SearchService, SearchServiceError
except ImportError:
    # Works when workspace root is the active source root.
    from backend.services.search_service import SearchService, SearchServiceError


search_bp = Blueprint("search", __name__)


@search_bp.post("/api/search")
def search_content_items():
    """Return paginated content cards for the search results page."""
    payload = request.get_json(silent=True) or {}
    service = SearchService()

    try:
        data = service.search(payload)
        return jsonify(data), 200
    except SearchServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


@search_bp.get("/api/search/filters")
def get_search_filters_metadata():
    """Return metadata lists for search filters dropdowns."""
    service = SearchService()

    try:
        data = service.get_filters_metadata()
        return jsonify(data), 200
    except SearchServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500

