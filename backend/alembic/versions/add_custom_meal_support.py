"""Add custom meal support to meal_plans

Revision ID: add_custom_meal
Revises: add_share_status
Create Date: 2025-01-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_custom_meal'
down_revision: Union[str, None] = 'add_share_status'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add custom item fields first
    op.add_column('meal_plans', sa.Column('custom_title', sa.String(255), nullable=True))
    op.add_column('meal_plans', sa.Column('custom_description', sa.Text(), nullable=True))

    # For SQLite, we need to use batch operations to change column nullability
    # This recreates the table with the modified schema
    with op.batch_alter_table('meal_plans', schema=None) as batch_op:
        batch_op.alter_column('recipe_id',
                              existing_type=sa.String(),
                              nullable=True)


def downgrade() -> None:
    # Revert: make recipe_id non-nullable and drop custom columns
    with op.batch_alter_table('meal_plans', schema=None) as batch_op:
        batch_op.alter_column('recipe_id',
                              existing_type=sa.String(),
                              nullable=False)

    op.drop_column('meal_plans', 'custom_description')
    op.drop_column('meal_plans', 'custom_title')
