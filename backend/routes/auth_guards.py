"""Reusable auth/authorization decorators for protected routes."""

from __future__ import annotations

from functools import wraps
from typing import Callable

from flask import g, jsonify, session

try:
    # Works when backend/ is the active source root.
    from services.auth_service import AuthService
except ImportError:
    # Works when workspace root is the active source root.
    from backend.services.auth_service import AuthService


def login_required(func: Callable):
    """Require authenticated session and attach current user to flask.g."""

    @wraps(func)
    def wrapper(*args, **kwargs):
        user_id = session.get("user_id")
        if not user_id:
            return jsonify({"error": "Unauthorized"}), 401

        auth_service = AuthService()
        user = auth_service.get_user_by_id(int(user_id))
        if not user:
            session.clear()
            return jsonify({"error": "Unauthorized"}), 401

        g.current_user = user
        return func(*args, **kwargs)

    return wrapper


def role_required(*allowed_roles: str, permission_code: str | None = "site_admin"):
    """
    Require role/permission for protected endpoints.

    Access is allowed when either:
    - user has the configured permission_code (default: site_admin), or
    - user has at least one of the supplied allowed_roles.
    """

    normalized_roles = {role.strip().lower() for role in allowed_roles if role and role.strip()}
    normalized_permission = (permission_code or "").strip().lower() or None

    def decorator(func: Callable):
        @wraps(func)
        def wrapper(*args, **kwargs):
            user = getattr(g, "current_user", None)
            if not user:
                # Supports standalone usage without @login_required.
                user_id = session.get("user_id")
                if not user_id:
                    return jsonify({"error": "Unauthorized"}), 401

                auth_service = AuthService()
                user = auth_service.get_user_by_id(int(user_id))
                if not user:
                    session.clear()
                    return jsonify({"error": "Unauthorized"}), 401
                g.current_user = user

            user_roles = {str(role).strip().lower() for role in (user.get("roles") or []) if role}
            user_permissions = {
                str(permission).strip().lower()
                for permission in (user.get("permissions") or [])
                if permission
            }

            if normalized_permission and normalized_permission in user_permissions:
                return func(*args, **kwargs)

            if normalized_roles and normalized_roles.intersection(user_roles):
                return func(*args, **kwargs)

            return jsonify({"error": "Forbidden"}), 403

        return wrapper

    return decorator

