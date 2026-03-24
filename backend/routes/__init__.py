"""Flask route blueprints."""

from .auth_routes import auth_bp
from .content_routes import content_bp
from .home_routes import home_bp
from .search_routes import search_bp

__all__ = ["auth_bp", "content_bp", "home_bp", "search_bp"]

