"""Seed canonical measurement units

Revision ID: seed_measurement_units
Revises: add_instruction_usages
Create Date: 2026-06-14
"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa


revision: str = "seed_measurement_units"
down_revision: Union[str, Sequence[str], None] = "add_instruction_usages"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


UNITS = [
    ("teaspoon", "tsp", "volume"),
    ("tablespoon", "tbsp", "volume"),
    ("cup", "c", "volume"),
    ("fluid ounce", "fl oz", "volume"),
    ("pint", "pt", "volume"),
    ("quart", "qt", "volume"),
    ("gallon", "gal", "volume"),
    ("milliliter", "ml", "volume"),
    ("liter", "L", "volume"),
    ("ounce", "oz", "weight"),
    ("pound", "lb", "weight"),
    ("gram", "g", "weight"),
    ("kilogram", "kg", "weight"),
    ("pinch", None, "volume"),
    ("dash", None, "volume"),
    ("piece", "pc", "count"),
    ("slice", None, "count"),
    ("clove", None, "count"),
    ("sprig", None, "count"),
    ("bunch", None, "count"),
    ("head", None, "count"),
    ("stalk", None, "count"),
    ("stick", None, "count"),
    ("can", None, "container"),
    ("jar", None, "container"),
    ("bottle", None, "container"),
    ("box", None, "container"),
    ("bag", None, "container"),
    ("package", "pkg", "container"),
]


def upgrade() -> None:
    units = sa.table(
        "measurement_units",
        sa.column("id", sa.String()),
        sa.column("name", sa.String()),
        sa.column("abbreviation", sa.String()),
        sa.column("type", sa.String()),
        sa.column("is_system", sa.Boolean()),
    )
    conn = op.get_bind()
    for name, abbreviation, unit_type in UNITS:
        exists = conn.execute(
            sa.text("SELECT 1 FROM measurement_units WHERE name = :name"),
            {"name": name},
        ).first()
        if not exists:
            conn.execute(
                units.insert().values(
                    id=str(uuid.uuid4()),
                    name=name,
                    abbreviation=abbreviation,
                    type=unit_type,
                    is_system=True,
                )
            )


def downgrade() -> None:
    names = [name for name, _, _ in UNITS]
    op.get_bind().execute(
        sa.text("DELETE FROM measurement_units WHERE is_system = true AND name IN :names")
        .bindparams(sa.bindparam("names", expanding=True)),
        {"names": names},
    )
