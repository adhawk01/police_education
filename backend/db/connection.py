"""
db/connection.py
----------------
Central database access layer.

Provides:
- get_connection()     : returns a plain mysql.connector connection (caller closes it)
- db_connection()      : context manager that auto-closes the connection

Usage in a repository:

    from db.connection import db_connection

    with db_connection() as conn:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))
        row = cursor.fetchone()
"""

import os
from contextlib import contextmanager

import mysql.connector
from mysql.connector import Error
from dotenv import load_dotenv

# Load variables from .env into the environment when this module is imported.
load_dotenv()


def _get_db_config() -> dict:
    """Read database credentials from environment variables."""
    return {
        "host":     os.getenv("DB_HOST", "localhost"),
        "port":     int(os.getenv("DB_PORT", 3306)),
        "database": os.getenv("DB_NAME"),
        "user":     os.getenv("DB_USER"),
        "password": os.getenv("DB_PASSWORD"),
    }


def get_connection() -> mysql.connector.MySQLConnection:
    """
    Open and return a new MySQL connection.

    The caller is responsible for closing the connection.
    Prefer the db_connection() context manager for automatic cleanup.

    Raises:
        ConnectionError: if the connection cannot be established.
    """
    config = _get_db_config()
    try:
        conn = mysql.connector.connect(**config)
        return conn
    except Error as e:
        raise ConnectionError(f"Could not connect to MySQL: {e}") from e


@contextmanager
def db_connection():
    """
    Context manager that opens a MySQL connection and closes it automatically.

    Example:
        with db_connection() as conn:
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT 1")
    """
    conn = get_connection()
    try:
        yield conn
    finally:
        if conn.is_connected():
            conn.close()

