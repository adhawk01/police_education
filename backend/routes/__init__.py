"""Flask route blueprints."""

from .home_routes import home_bp
from .search_routes import search_bp

__all__ = ["home_bp", "search_bp"]

