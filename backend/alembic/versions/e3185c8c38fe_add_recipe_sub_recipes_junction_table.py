"""add recipe_sub_recipes junction table

Revision ID: e3185c8c38fe
Revises: 9c46aa07e8d2
Create Date: 2026-01-03 16:14:24.428412

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e3185c8c38fe'
down_revision: Union[str, Sequence[str], None] = '9c46aa07e8d2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Create recipe_sub_recipes junction table for composite recipes."""
    op.create_table(
        'recipe_sub_recipes',
        sa.Column('parent_recipe_id', sa.String(), sa.ForeignKey('recipes.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('sub_recipe_id', sa.String(), sa.ForeignKey('recipes.id', ondelete='CASCADE'), primary_key=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('scale_factor', sa.Float(), nullable=False, server_default='1.0'),
        sa.Column('section_title', sa.String(100), nullable=True),
        sa.Column('added_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    """Drop recipe_sub_recipes junction table."""
    op.drop_table('recipe_sub_recipes')
