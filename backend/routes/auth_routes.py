"""Authentication API routes."""

from flask import Blueprint, jsonify, request, session

try:
    # Works when backend/ is the active source root.
    from services.auth_service import (
        AuthConflictError,
        AuthService,
        AuthServiceError,
        AuthUnauthorizedError,
        AuthValidationError,
    )
except ImportError:
    # Works when workspace root is the active source root.
    from backend.services.auth_service import (
        AuthConflictError,
        AuthService,
        AuthServiceError,
        AuthUnauthorizedError,
        AuthValidationError,
    )


auth_bp = Blueprint("auth", __name__)


@auth_bp.post("/api/auth/register")
def register():
    """Register a new user and start an authenticated session."""
    payload = request.get_json(silent=True) or {}
    service = AuthService()

    try:
        user = service.register(payload)
        session.clear()
        session["user_id"] = user["id"]
        return jsonify({"message": "Registration successful", "user": user}), 201
    except AuthValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except AuthConflictError as exc:
        return jsonify({"error": str(exc)}), 409
    except AuthServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


@auth_bp.post("/api/auth/login")
def login():
    """Authenticate existing user and start session."""
    payload = request.get_json(silent=True) or {}
    service = AuthService()

    try:
        user = service.login(payload)
        session.clear()
        session["user_id"] = user["id"]
        return jsonify({"message": "Login successful", "user": user}), 200
    except AuthValidationError as exc:
        return jsonify({"error": str(exc)}), 400
    except AuthUnauthorizedError as exc:
        return jsonify({"error": str(exc)}), 401
    except AuthServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500


@auth_bp.post("/api/auth/logout")
def logout():
    """Clear authenticated session."""
    session.clear()
    return jsonify({"message": "Logout successful"}), 200


@auth_bp.get("/api/auth/me")
def me():
    """Return currently authenticated user from session."""
    user_id = session.get("user_id")
    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    service = AuthService()
    try:
        user = service.get_user_by_id(int(user_id))
        if not user:
            session.clear()
            return jsonify({"error": "Unauthorized"}), 401
        return jsonify({"user": user}), 200
    except AuthServiceError as exc:
        return jsonify({"error": str(exc)}), 500
    except Exception:
        return jsonify({"error": "Unexpected server error"}), 500

