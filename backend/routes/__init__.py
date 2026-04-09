"""Flask route blueprints."""

from .admin_routes import admin_bp
from .ai_routes import ai_bp
from .auth_routes import auth_bp
from .content_routes import content_bp
from .home_routes import home_bp
from .search_routes import search_bp

__all__ = ["admin_bp", "ai_bp", "auth_bp", "content_bp", "home_bp", "search_bp"]

