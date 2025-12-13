"""initial_schema

Revision ID: 9c46aa07e8d2
Revises:
Create Date: 2025-12-13 14:21:05.241882

This is a baseline migration representing the existing schema.
Both local and production databases should be stamped at this revision.
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '9c46aa07e8d2'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Baseline - existing schema, no changes needed."""
    pass


def downgrade() -> None:
    """Cannot downgrade from baseline."""
    pass
