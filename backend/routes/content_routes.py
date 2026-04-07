"""Content item details API routes."""

from flask import Blueprint, jsonify

try:
    # Works when backend/ is the active source root.
    from services.content_service import ContentNotFoundError, ContentService, ContentServiceError
except ImportError:
    # Works when workspace root is the active source root.
    from backend.services.content_service import ContentNotFoundError, ContentService, ContentServiceError


content_bp = Blueprint("content", __name__)


@content_bp.get("/api/content-items/<int:content_item_id>")
def get_content_item_details(content_item_id: int):
    """Return data needed by the content details page."""
    service = ContentService()

    try:
        payload = service.get_content_item_details(content_item_id)
        return jsonify(payload), 200
    except ContentNotFoundError as exc:
        return jsonify({"error": str(exc)}), 404
    except ContentServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500

