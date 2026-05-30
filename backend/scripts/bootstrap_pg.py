"""
Bootstrap a FRESH database from the SQLAlchemy models, then mark Alembic as
fully migrated — without replaying the migration history.

Why this exists
---------------
Three migrations in alembic/versions/ are SQLite-only and crash on Postgres:
  - fix_schema_drift.py / add_oauth_authorization_codes.py  → query sqlite_master
  - remove_grocery_list_user_unique.py                      → SQLite table-rebuild
So `alembic upgrade head` against a brand-new Postgres DB fails. For a fresh DB
we instead create the schema directly from models.Base (the current, correct
shape) and `alembic stamp head` so future `alembic upgrade head` calls (in
start.sh) are no-ops until the NEXT, Postgres-safe migration is added.

When NOT to use this
--------------------
If you are migrating existing data with pgloader, pgloader creates the tables
itself — skip create_all and only run the stamp step:
    python scripts/bootstrap_pg.py --stamp-only

Run from the backend root (where alembic.ini lives):
    DATABASE_URL=postgresql+psycopg2://user:pass@host:5432/potatoes \
        python scripts/bootstrap_pg.py
"""

import os
import sys

# Allow `python scripts/bootstrap_pg.py` from the backend root.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from alembic import command
from alembic.config import Config

from config import settings
from database import Base, engine
import models  # noqa: F401 — registers all tables on Base.metadata


def main() -> None:
    stamp_only = "--stamp-only" in sys.argv

    print(f"[bootstrap] target: {engine.url.render_as_string(hide_password=True)}")

    if not stamp_only:
        print(f"[bootstrap] create_all() — {len(Base.metadata.tables)} tables")
        Base.metadata.create_all(bind=engine)
    else:
        print("[bootstrap] --stamp-only: skipping create_all (pgloader made the schema)")

    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    alembic_cfg = Config(os.path.join(backend_root, "alembic.ini"))
    alembic_cfg.set_main_option("sqlalchemy.url", settings.database_url)

    print("[bootstrap] alembic stamp head")
    command.stamp(alembic_cfg, "head")

    print("[bootstrap] done — DB is at head, no migrations were replayed")


if __name__ == "__main__":
    main()
