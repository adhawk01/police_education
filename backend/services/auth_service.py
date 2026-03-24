"""Service layer for authentication operations."""

from __future__ import annotations

import re
from typing import Any

from mysql.connector import Error
from werkzeug.security import check_password_hash, generate_password_hash

try:
    # Works when backend/ is the active source root.
    from repositories.auth_repository import AuthRepository
    from serializers.auth_serializer import serialize_user
except ImportError:
    # Works when workspace root is the active source root.
    from backend.repositories.auth_repository import AuthRepository
    from backend.serializers.auth_serializer import serialize_user


class AuthServiceError(Exception):
    """Base auth service error."""


class AuthValidationError(AuthServiceError):
    """Invalid payload or missing required fields."""


class AuthConflictError(AuthServiceError):
    """Conflict such as duplicate email."""


class AuthUnauthorizedError(AuthServiceError):
    """Unauthorized credentials or session state."""


class AuthService:
    """Coordinates registration, login, and current-user retrieval."""

    def __init__(self, repository: AuthRepository | None = None):
        self._repository = repository or AuthRepository()

    def register(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Register a user with a securely hashed password."""
        full_name = (payload.get("full_name") or "").strip()
        email = (payload.get("email") or "").strip().lower()
        password = payload.get("password") or ""

        self._validate_register_payload(full_name, email, password)

        if self._repository.get_user_by_email(email):
            raise AuthConflictError("Email is already registered")

        status_id = self._repository.get_default_active_status_id()
        if not status_id:
            raise AuthServiceError("No active user status is configured in the database")

        password_hash = generate_password_hash(password)

        try:
            user = self._repository.create_user(full_name, email, password_hash, status_id)
        except Error as exc:
            # Duplicate email race condition protection.
            if getattr(exc, "errno", None) == 1062:
                raise AuthConflictError("Email is already registered") from exc
            raise AuthServiceError(f"Failed to create user: {exc}") from exc

        return serialize_user(user)

    def login(self, payload: dict[str, Any]) -> dict[str, Any]:
        """Authenticate by email/password and return safe user info."""
        email = (payload.get("email") or "").strip().lower()
        password = payload.get("password") or ""

        if not email or not password:
            raise AuthValidationError("Email and password are required")

        user = self._repository.get_user_by_email(email)
        if not user:
            raise AuthUnauthorizedError("Invalid email or password")

        if not bool(user.get("status_is_active", 0)):
            raise AuthUnauthorizedError("User account is inactive")

        if not check_password_hash(user["password_hash"], password):
            raise AuthUnauthorizedError("Invalid email or password")

        return serialize_user(user)

    def get_user_by_id(self, user_id: int) -> dict[str, Any] | None:
        """Load current user by session id and return safe payload."""
        user = self._repository.get_user_by_id(user_id)
        if not user:
            return None
        if not bool(user.get("status_is_active", 0)):
            return None
        return serialize_user(user)

    @staticmethod
    def _validate_register_payload(full_name: str, email: str, password: str) -> None:
        """Validate register payload with simple user-facing constraints."""
        if not full_name or not email or not password:
            raise AuthValidationError("full_name, email, and password are required")

        if len(full_name) > 150:
            raise AuthValidationError("full_name must be 150 characters or fewer")

        if len(email) > 255:
            raise AuthValidationError("email must be 255 characters or fewer")

        if not re.match(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", email):
            raise AuthValidationError("email format is invalid")

        if len(password) < 8:
            raise AuthValidationError("password must be at least 8 characters")

