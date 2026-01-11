"""Add LibraryShare model for mutual recipe library sharing

Revision ID: e4c609c2a526
Revises: add_custom_meal
Create Date: 2026-01-11 09:27:34.516282

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'e4c609c2a526'
down_revision: Union[str, Sequence[str], None] = 'add_custom_meal'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'library_shares',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('inviter_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('invitee_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('status', sa.String(20), default='pending', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('accepted_at', sa.DateTime(timezone=True), nullable=True),
        sa.UniqueConstraint('inviter_id', 'invitee_id', name='uq_library_share'),
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_table('library_shares')
