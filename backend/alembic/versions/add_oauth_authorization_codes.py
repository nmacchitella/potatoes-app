"""Add OAuth authorization codes table for MCP

Revision ID: add_oauth_codes
Revises: fix_schema_drift
Create Date: 2026-02-22
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_oauth_codes'
down_revision: Union[str, None] = 'fix_schema_drift'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Check if table already exists (idempotent)
    conn = op.get_bind()
    result = conn.execute(
        sa.text("SELECT 1 FROM sqlite_master WHERE type='table' AND name='oauth_authorization_codes'")
    )
    if result.fetchone() is not None:
        return

    op.create_table(
        'oauth_authorization_codes',
        sa.Column('code', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('client_id', sa.String(), nullable=False),
        sa.Column('redirect_uri', sa.String(), nullable=False),
        sa.Column('code_challenge', sa.String(), nullable=False),
        sa.Column('code_challenge_method', sa.String(), nullable=False, server_default='S256'),
        sa.Column('scope', sa.String(), nullable=False, server_default=''),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table('oauth_authorization_codes')
