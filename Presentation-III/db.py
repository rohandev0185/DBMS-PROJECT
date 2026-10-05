import pymysql
import pymysql.cursors
import os
from config import Config

def get_connection(include_db=True):
    """Establish and return a PyMySQL connection with dictionary cursor."""
    kwargs = {
        'host': Config.MYSQL_HOST,
        'port': Config.MYSQL_PORT,
        'user': Config.MYSQL_USER,
        'password': Config.MYSQL_PASSWORD,
        'charset': 'utf8mb4',
        'cursorclass': pymysql.cursors.DictCursor,
        'autocommit': True
    }
    if include_db:
        kwargs['database'] = Config.MYSQL_DB
    return pymysql.connect(**kwargs)

def check_connection():
    """Verify if MySQL server is reachable and database exists."""
    try:
        conn = get_connection(include_db=False)
        with conn.cursor() as cursor:
            cursor.execute("SELECT VERSION() AS version;")
            ver = cursor.fetchone()
            cursor.execute(f"SHOW DATABASES LIKE '{Config.MYSQL_DB}';")
            has_db = cursor.fetchone() is not None
        conn.close()
        return {
            "status": "connected",
            "version": ver['version'] if ver else "9.7",
            "database_exists": has_db,
            "host": f"{Config.MYSQL_HOST}:{Config.MYSQL_PORT}",
            "user": Config.MYSQL_USER
        }
    except Exception as e:
        return {
            "status": "error",
            "message": str(e),
            "host": f"{Config.MYSQL_HOST}:{Config.MYSQL_PORT}",
            "user": Config.MYSQL_USER
        }

def init_database(sql_file_path=None):
    """Run SQL initialization script to create tables and seed data."""
    if not sql_file_path:
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sql_file_path = os.path.join(base_dir, 'Presentation-II', 'library_db.sql')

    if not os.path.exists(sql_file_path):
        raise FileNotFoundError(f"SQL file not found at {sql_file_path}")

    with open(sql_file_path, 'r', encoding='utf-8') as f:
        sql_content = f.read()

    conn = get_connection(include_db=False)
    try:
        with conn.cursor() as cursor:
            # Split by statements
            statements = [stmt.strip() for stmt in sql_content.split(';') if stmt.strip()]
            for stmt in statements:
                # Skip comments or empty queries
                clean_lines = [line for line in stmt.splitlines() if not line.strip().startswith('--')]
                clean_stmt = '\n'.join(clean_lines).strip()
                if clean_stmt:
                    cursor.execute(clean_stmt)
        return {"success": True, "message": "Database initialized and seeded successfully."}
    finally:
        conn.close()

def query_db(query, args=(), one=False):
    """Execute read query and return dictionary results."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(query, args)
            rv = cursor.fetchall()
            return (rv[0] if rv else None) if one else rv
    finally:
        conn.close()

def modify_db(query, args=()):
    """Execute INSERT, UPDATE, or DELETE query and return affected rows and lastrowid."""
    conn = get_connection()
    try:
        with conn.cursor() as cursor:
            affected = cursor.execute(query, args)
            last_id = cursor.lastrowid
            return {"affected_rows": affected, "last_id": last_id}
    finally:
        conn.close()
