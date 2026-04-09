"""Home page API routes."""

import logging
from flask import Blueprint, jsonify

try:
    # Works when backend/ is the active source root.
    from services.home_service import HomeService, HomeServiceError
except ImportError:
    # Works when workspace root is the active source root.
    from backend.services.home_service import HomeService, HomeServiceError

logger = logging.getLogger(__name__)
home_bp = Blueprint("home", __name__)


@home_bp.get("/api/home")
def get_home_page():
    """Return all data needed for the dynamic home page."""
    logger.info("GET /api/home called")
    service = HomeService()

    try:
        data = service.get_home_page_data()
        return jsonify(data), 200
    except HomeServiceError as exc:
        # Service-level failures (for example DB access issues).
        return jsonify({"error": str(exc)}), 500
    except Exception:
        # Keep unexpected failures generic and safe for clients.
        return jsonify({"error": "Unexpected server error"}), 500

