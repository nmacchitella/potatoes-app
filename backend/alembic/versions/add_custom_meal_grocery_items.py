"""Add grocery_items JSON column to meal_plans for custom meal grocery tracking.

Revision ID: add_grocery_items
Revises: add_oauth_codes
Create Date: 2026-02-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_grocery_items'
down_revision: Union[str, Sequence[str], None] = 'add_oauth_codes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('meal_plans', sa.Column('grocery_items', sa.JSON(), nullable=True))


def downgrade() -> None:
    op.drop_column('meal_plans', 'grocery_items')
