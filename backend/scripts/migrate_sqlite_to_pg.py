"""
Copy all data from a SQLite database into the target (Postgres) database.

Used once during the Fly → Beelink cutover: the Fly prod SQLite file is pulled
off the volume, then this loads it into the shared Postgres `potatoes` DB.

Why a Python ETL instead of pgloader
------------------------------------
We read through the SQLAlchemy *models*, so each column's result processor runs
(SQLite 0/1 → Python bool, ISO strings → datetime, TEXT → JSON). The target
schema is created from the same models, so types line up exactly — no
boolean-as-bigint / json-as-text drift that a schema-inferring tool can produce.

Schema is created from models.Base (canonical, = current Alembic head). Only
columns present in BOTH the model and the source table are copied, so a source
that is a few migrations behind still loads (new columns take their defaults).

Run inside the api image so models + psycopg2 are available, e.g.:
    docker compose run --rm \
      -e SOURCE_SQLITE_PATH=/import/potatoes_prod.db \
      -v /home/nicola/potatoes_prod.db:/import/potatoes_prod.db:ro \
      potatoes-api python scripts/migrate_sqlite_to_pg.py

The target DB is settings.database_url (the container's DATABASE_URL).
Idempotent: every target table is emptied before loading.
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import BigInteger, Integer, MetaData, create_engine, select, text

from database import Base, engine as target_engine
import models  # noqa: F401 — registers tables on Base.metadata


def main() -> None:
    src_path = os.environ.get("SOURCE_SQLITE_PATH")
    if not src_path or not os.path.exists(src_path):
        sys.exit(f"SOURCE_SQLITE_PATH not set or missing: {src_path!r}")

    if target_engine.dialect.name == "sqlite":
        sys.exit("Refusing to run: target DATABASE_URL is sqlite (expected Postgres).")

    src_engine = create_engine(f"sqlite:///{src_path}")
    src_meta = MetaData()
    src_meta.reflect(bind=src_engine)

    print(f"[migrate] target : {target_engine.url.render_as_string(hide_password=True)}")
    print(f"[migrate] source : {src_path}")
    print("[migrate] create_all() on target (canonical schema from models)")
    Base.metadata.create_all(bind=target_engine)

    tables = Base.metadata.sorted_tables  # FK-dependency order
    total = 0

    with src_engine.connect() as src, target_engine.begin() as tgt:
        # Clear in reverse dependency order so FKs don't block deletes.
        for table in reversed(tables):
            tgt.execute(table.delete())

        for table in tables:
            src_table = src_meta.tables.get(table.name)
            if src_table is None:
                print(f"  {table.name}: (not in source) skip")
                continue

            # Model-typed columns that also exist in the source → correct
            # Python types on read, mild schema drift tolerated.
            cols = [c for c in table.columns if c.name in src_table.columns]
            rows = src.execute(select(*cols)).mappings().all()
            if rows:
                tgt.execute(table.insert(), [dict(r) for r in rows])
            total += len(rows)
            print(f"  {table.name}: {len(rows)}")

        # Reset Postgres identity sequences to MAX(pk) so new inserts don't collide.
        for table in tables:
            pks = list(table.primary_key.columns)
            if len(pks) != 1 or not isinstance(pks[0].type, (Integer, BigInteger)):
                continue
            col = pks[0].name
            seq = tgt.execute(
                text("SELECT pg_get_serial_sequence(:t, :c)"),
                {"t": table.name, "c": col},
            ).scalar()
            if not seq:
                continue
            maxid = tgt.execute(text(f'SELECT MAX("{col}") FROM "{table.name}"')).scalar()
            if maxid is not None:
                tgt.execute(text("SELECT setval(:s, :v, true)"), {"s": seq, "v": maxid})

    print(f"[migrate] done — {total} rows across {len(tables)} tables")


if __name__ == "__main__":
    main()
