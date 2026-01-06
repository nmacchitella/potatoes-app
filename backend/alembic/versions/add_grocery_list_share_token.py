"""Add share_token to grocery_lists

Revision ID: add_share_token
Revises: e3185c8c38fe
Create Date: 2025-01-06

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_share_token'
down_revision: Union[str, None] = 'e3185c8c38fe'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('grocery_lists', sa.Column('share_token', sa.String(32), nullable=True))
    op.create_index('ix_grocery_lists_share_token', 'grocery_lists', ['share_token'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_grocery_lists_share_token', table_name='grocery_lists')
    op.drop_column('grocery_lists', 'share_token')
