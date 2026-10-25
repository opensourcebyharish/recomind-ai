"""Apply the rating catalog schema migration before production deployment."""

from app.core.config import get_settings
from app.database.migrations import migrate_rating_catalog
from app.database.session import create_db_engine


def main() -> None:
    engine = create_db_engine(get_settings())
    try:
        changed = migrate_rating_catalog(engine)
        print("Added rating catalog column; existing ratings are preserved as local." if changed else "Rating catalog migration already applied.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
