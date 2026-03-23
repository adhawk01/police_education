"""
db/__init__.py
--------------
Re-exports the public interface of the db package so imports stay short:

    from db import db_connection, get_connection
"""

from .connection import db_connection, get_connection

__all__ = ["db_connection", "get_connection"]

