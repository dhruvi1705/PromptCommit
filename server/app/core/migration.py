"""
Legacy collection_name → collection_prompts backfill migration.

Safe, idempotent migration that converts legacy Prompt.collection_name
references into canonical collection_prompts M2M associations.

Rules:
- User-isolated: User A's prompt only links to User A's collection
- Ignores 'General', None, or empty collection names
- Prevents duplicate associations
- Creates missing collections for the prompt owner if needed
- Never associates with another user's collection
- Never creates a fake 'General' collection
- Reports unresolved legacy values
- Safe to run multiple times (idempotent)
"""
import logging
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.collection import Collection, collection_prompts
from app.models.prompt import Prompt
from app.models.user import User

logger = logging.getLogger("promptcommit.migration")

STANDARD_COLLECTION_DEFAULT_TAGS = {
    "coding": ["Code", "Coding", "Development"],
    "research": ["Research", "Analysis", "Academic"],
    "marketing": ["Marketing", "Copywriting", "Content"],
    "engineering": ["Engineering", "Architecture", "System"],
    "education": ["Education", "Tutorial", "Learning"],
    "ui design": ["Design", "UI", "UX"],
    "ui prompts": ["Design", "UI", "UX"],
    "production agents": ["Production", "Agents", "Automation"],
    "development": ["Development", "Code", "Engineering"]
}


def migrate_legacy_collections() -> dict:
    """
    Safely migrates legacy Prompt.collection_name references to the authoritative
    collection_prompts association table and Collection entities.
    Also ensures collection default_tags are populated.

    Returns a stats dict with migration results.
    """
    db: Session = SessionLocal()
    stats = {
        "migrated_prompts": 0,
        "collections_created": 0,
        "associations_created": 0,
        "default_tags_updated": 0,
        "skipped_general": 0,
        "skipped_empty": 0,
        "already_associated": 0,
        "errors": []
    }
    try:
        # Phase 1: Populate default tags on existing collections if empty
        cols = db.query(Collection).all()
        for c in cols:
            if not c.default_tags:
                cname_lower = (c.name or "").lower().strip()
                if cname_lower in STANDARD_COLLECTION_DEFAULT_TAGS:
                    c.default_tags_list = STANDARD_COLLECTION_DEFAULT_TAGS[cname_lower]
                else:
                    c.default_tags_list = [c.name.strip()]
                stats["default_tags_updated"] += 1

        # Phase 2: Backfill legacy collection_name → collection_prompts
        prompts = db.query(Prompt).all()
        for p in prompts:
            col_name = (p.collection_name or "").strip()
            if not col_name:
                stats["skipped_empty"] += 1
                continue
            if col_name.lower() == "general":
                stats["skipped_general"] += 1
                continue

            # Find matching collection for THIS specific user only
            col = db.query(Collection).filter(
                Collection.user_id == p.user_id,
                Collection.name.ilike(col_name)
            ).first()

            if not col:
                # Create collection for this user
                col = Collection(
                    user_id=p.user_id,
                    name=col_name,
                    description=f"{col_name} prompts collection.",
                    icon="FolderKanban",
                    color="blue"
                )
                cname_lower = col_name.lower().strip()
                if cname_lower in STANDARD_COLLECTION_DEFAULT_TAGS:
                    col.default_tags_list = STANDARD_COLLECTION_DEFAULT_TAGS[cname_lower]
                else:
                    col.default_tags_list = [col_name.strip()]
                db.add(col)
                db.flush()
                stats["collections_created"] += 1
                logger.info(f"  Created collection '{col_name}' for user {p.user_id}")

            # Check if association already exists — prevent duplicates
            if col not in p.collections:
                p.collections.append(col)
                stats["associations_created"] += 1
                stats["migrated_prompts"] += 1
            else:
                stats["already_associated"] += 1

        db.commit()
        logger.info(f"Legacy collection migration completed: {stats}")
        return stats

    except Exception as e:
        db.rollback()
        error_msg = f"Legacy collection migration error: {e}"
        logger.error(error_msg)
        stats["errors"].append(error_msg)
        return stats
    finally:
        db.close()
