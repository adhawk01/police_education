"""AI API routes."""

from flask import Blueprint, jsonify, request, session

try:
    # Works when backend/ is the active source root.
    from services.ai_service import AIService, AIServiceError, AIValidationError
    from services.auth_service import AuthService
except ImportError:
    # Works when workspace root is the active source root.
    from backend.services.ai_service import AIService, AIServiceError, AIValidationError
    from backend.services.auth_service import AuthService


ai_bp = Blueprint("ai", __name__)


@ai_bp.post("/api/ai/ask")
def ask_ai():
    """Return model answer for prompt (authenticated users only)."""
    print(">>> /api/ai/ask was called")
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    auth_service = AuthService()
    user = auth_service.get_user_by_id(int(user_id))
    if not user:
        session.clear()
        return jsonify({"error": "Unauthorized"}), 401

    payload = request.get_json(silent=True) or {}
    service = AIService()

    try:
        answer = service.ask(payload)
        print(">>> /api/ai/ask sending answer back to frontend")
        return jsonify({"answer": answer}), 200
    except AIValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except AIServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500

