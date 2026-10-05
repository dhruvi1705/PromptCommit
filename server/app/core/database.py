"""
Database initialization, schema creation, and migration management.

Strategy:
- Fresh database: create_all() creates the full schema
- Existing database: Tracked, idempotent migrations handle schema evolution
- Migration state: schema_migrations table records applied migrations
- Migration failures: Logged with details, rollback, and clear error reporting
"""
import logging
from sqlalchemy import create_engine, text, inspect, event
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.core.config import settings

logger = logging.getLogger("promptcommit.database")

class MigrationError(Exception):
    """Raised when a schema migration fails."""
    pass

# MySQL SQLAlchemy Engine with connection pool
engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False
)

@event.listens_for(Engine, "connect")
def set_sqlite_pragma(dbapi_connection, connection_record):
    """Enforce SQLite Foreign Keys when SQLite database engine is used."""
    if "sqlite" in str(type(dbapi_connection)).lower() or hasattr(dbapi_connection, "execute"):
        try:
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON;")
            cursor.close()
        except Exception:
            pass

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()

def get_db():
    """FastAPI dependency for database sessions"""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# =====================================================================
# Migration Registry
# =====================================================================

MIGRATIONS = [
    {
        "id": "001_add_review_workflow_fields",
        "description": "Add review workflow columns to prompt_versions",
        "statements": [
            "ALTER TABLE prompt_versions ADD COLUMN review_status VARCHAR(30) DEFAULT 'DRAFT'",
            "ALTER TABLE prompt_versions ADD COLUMN reviewer_id VARCHAR(64) NULL",
            "ALTER TABLE prompt_versions ADD COLUMN reviewer_name VARCHAR(100) NULL",
            "ALTER TABLE prompt_versions ADD COLUMN reviewer_email VARCHAR(255) NULL",
            "ALTER TABLE prompt_versions ADD COLUMN review_message TEXT NULL",
            "ALTER TABLE prompt_versions ADD COLUMN review_feedback TEXT NULL",
            "ALTER TABLE prompt_versions ADD COLUMN review_requested_at DATETIME NULL",
            "ALTER TABLE prompt_versions ADD COLUMN reviewed_at DATETIME NULL",
        ]
    },
    {
        "id": "002_add_collection_default_tags",
        "description": "Add default_tags column to collections",
        "statements": [
            "ALTER TABLE collections ADD COLUMN default_tags TEXT NULL",
        ]
    },
]


def _ensure_migration_table(conn):
    """Create the schema_migrations tracking table if it doesn't exist."""
    conn.execute(text("""
        CREATE TABLE IF NOT EXISTS schema_migrations (
            id VARCHAR(255) PRIMARY KEY,
            description VARCHAR(500) NULL,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    """))
    conn.commit()


def _is_migration_applied(conn, migration_id: str) -> bool:
    """Check if a migration has already been applied."""
    result = conn.execute(
        text("SELECT id FROM schema_migrations WHERE id = :mid"),
        {"mid": migration_id}
    )
    return result.fetchone() is not None


def _mark_migration_applied(conn, migration_id: str, description: str):
    """Record a successfully applied migration."""
    conn.execute(
        text("INSERT INTO schema_migrations (id, description) VALUES (:mid, :desc)"),
        {"mid": migration_id, "desc": description}
    )
    conn.commit()


def _column_exists(inspector, table_name: str, column_name: str) -> bool:
    """Check if a column already exists in a table."""
    try:
        columns = inspector.get_columns(table_name)
        return any(col["name"] == column_name for col in columns)
    except Exception:
        return False


def run_migrations(migrations=None, raise_on_error: bool = True):
    """
    Execute all pending schema migrations with tracking and error reporting.
    
    Each migration is:
    - Checked against the schema_migrations registry
    - Skipped if already applied
    - Each ALTER statement checks column existence before executing
    - Failures trigger transaction rollback, clear logging, and raise MigrationError
    """
    if migrations is None:
        migrations = MIGRATIONS

    with engine.connect() as conn:
        _ensure_migration_table(conn)
        inspector = inspect(engine)

        for migration in migrations:
            mid = migration["id"]
            desc = migration["description"]

            if _is_migration_applied(conn, mid):
                continue  # Already applied

            logger.info(f"Applying migration: {mid} — {desc}")
            failed = False
            failed_stmt = None
            failed_error = None

            trans = conn.begin() if not conn.in_transaction() else None
            try:
                for stmt in migration["statements"]:
                    parts = stmt.split()
                    if len(parts) >= 6 and parts[0].upper() == "ALTER" and parts[3].upper() == "ADD":
                        tbl = parts[2]
                        col = parts[5]
                        if _column_exists(inspector, tbl, col):
                            continue  # Column already exists, skip safely

                    try:
                        conn.execute(text(stmt))
                    except Exception as e:
                        error_msg = str(e)
                        if "duplicate column" in error_msg.lower() or "already exists" in error_msg.lower():
                            logger.info(f"  Column already exists (safe skip): {stmt[:80]}")
                            continue
                        else:
                            failed = True
                            failed_stmt = stmt
                            failed_error = error_msg
                            break

                if not failed:
                    conn.execute(
                        text("INSERT INTO schema_migrations (id, description) VALUES (:mid, :desc)"),
                        {"mid": mid, "desc": desc}
                    )
                    if trans:
                        trans.commit()
                    else:
                        conn.commit()
                    logger.info(f"  Migration {mid} applied successfully.")
                else:
                    if trans:
                        trans.rollback()
                    else:
                        conn.rollback()
                    logger.error(f"Migration {mid} FAILED on statement: {failed_stmt[:120]}")
                    logger.error(f"  Error: {failed_error}")
                    logger.error(f"  Migration {mid} NOT marked as applied due to failure. Transaction rolled back.")
                    if raise_on_error:
                        raise MigrationError(f"Migration '{mid}' failed on statement '{failed_stmt[:120]}': {failed_error}")
            except MigrationError:
                raise
            except Exception as e:
                if trans:
                    trans.rollback()
                else:
                    conn.rollback()
                logger.error(f"Unexpected migration error for {mid}: {e}")
                if raise_on_error:
                    raise MigrationError(f"Migration '{mid}' failed with unexpected error: {e}")


def verify_schema() -> dict:
    """
    Verify that the database schema matches expected model definitions.
    Returns a dict with verification results.
    """
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())

    expected_tables = [
        "users", "prompts", "prompt_tags", "prompt_versions",
        "prompt_tests", "prompt_shares", "favorites",
        "collections", "collection_prompts",
        "collaboration_invitations", "notifications", "prompt_comments"
    ]

    results = {
        "missing_tables": [],
        "present_tables": [],
        "column_checks": {},
        "schema_migrations_exists": "schema_migrations" in existing_tables,
    }

    for tbl in expected_tables:
        if tbl in existing_tables:
            results["present_tables"].append(tbl)
        else:
            results["missing_tables"].append(tbl)

    # Spot-check critical columns
    critical_columns = {
        "prompts": ["id", "user_id", "title", "content", "category", "collection_name", "rating", "target_model"],
        "collections": ["id", "user_id", "name", "default_tags"],
        "collection_prompts": ["collection_id", "prompt_id"],
        "prompt_tests": ["id", "prompt_id", "user_id", "provider", "model"],
        "prompt_versions": ["id", "prompt_id", "review_status"],
        "prompt_shares": ["id", "prompt_id", "role"],
    }

    for tbl, expected_cols in critical_columns.items():
        if tbl not in existing_tables:
            results["column_checks"][tbl] = {"status": "TABLE_MISSING"}
            continue
        
        actual_cols = {col["name"] for col in inspector.get_columns(tbl)}
        missing = [c for c in expected_cols if c not in actual_cols]
        results["column_checks"][tbl] = {
            "status": "OK" if not missing else "MISSING_COLUMNS",
            "missing": missing
        }

    return results


def init_db():
    """Create all database tables defined in models and run tracked migrations."""
    # Import models so that Base.metadata recognizes them
    import app.models  # noqa
    Base.metadata.create_all(bind=engine)

    # Run tracked, idempotent migrations for schema evolution
    run_migrations()
