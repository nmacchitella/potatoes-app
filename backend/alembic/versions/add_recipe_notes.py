"""Add notes column to recipes table

Revision ID: add_recipe_notes
Revises: add_grocery_items
Create Date: 2026-02-23
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_recipe_notes'
down_revision: Union[str, Sequence[str], None] = 'add_grocery_items'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('recipes', sa.Column('notes', sa.Text(), nullable=True))


def downgrade() -> None:
    op.drop_column('recipes', 'notes')
