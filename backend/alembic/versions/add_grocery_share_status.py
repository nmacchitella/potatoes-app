"""Add status and updated_at columns to grocery_list_shares

Revision ID: add_share_status
Revises: remove_user_unique
Create Date: 2025-01-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'add_share_status'
down_revision: Union[str, None] = 'remove_user_unique'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add status column with default 'accepted' for existing shares
    op.add_column('grocery_list_shares', sa.Column('status', sa.String(20), server_default='accepted'))
    op.add_column('grocery_list_shares', sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now()))


def downgrade() -> None:
    op.drop_column('grocery_list_shares', 'updated_at')
    op.drop_column('grocery_list_shares', 'status')
