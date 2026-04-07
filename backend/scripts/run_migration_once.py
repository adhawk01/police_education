from pathlib import Path
from dotenv import load_dotenv
import os
import logging
import mysql.connector

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

base = Path.cwd()
load_dotenv(base / '.env')
required = ['DB_HOST', 'DB_PORT', 'DB_NAME', 'DB_USER', 'DB_PASSWORD']
missing = [k for k in required if not os.getenv(k)]
if missing:
    raise SystemExit('Missing required .env vars: ' + ', '.join(missing))
migration_path = base / 'database' / 'migrations' / '20260319_001_add_priority_to_content_categories.sql'
if not migration_path.exists():
    raise SystemExit('Migration file not found: ' + str(migration_path))
sql = migration_path.read_text(encoding='utf-8')
conn = None
try:
    conn = mysql.connector.connect(
        host=os.getenv('DB_HOST'),
        port=int(os.getenv('DB_PORT')),
        database=os.getenv('DB_NAME'),
        user=os.getenv('DB_USER'),
        password=os.getenv('DB_PASSWORD'),
        use_pure=True,
    )
    cur = conn.cursor()
    for _ in cur.execute(sql, multi=True):
        pass
    logger.info('Migration applied successfully: ' + migration_path.name)
except mysql.connector.Error as exc:
    logger.error('Migration failed: ' + str(exc))
    raise
finally:
    if conn is not None and conn.is_connected():
        conn.close()
