"""Remove UNIQUE constraint on user_id from grocery_lists to allow multiple lists per user

Revision ID: remove_user_unique
Revises: add_share_token
Create Date: 2025-01-10

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'remove_user_unique'
down_revision: Union[str, None] = 'add_share_token'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # SQLite doesn't support DROP CONSTRAINT, so we need to recreate the table
    # Create new table without the UNIQUE constraint on user_id
    op.execute('''
        CREATE TABLE grocery_lists_new (
            id VARCHAR NOT NULL,
            user_id VARCHAR NOT NULL,
            name VARCHAR(200),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            share_token VARCHAR(32),
            PRIMARY KEY (id),
            FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    # Copy data from old table
    op.execute('INSERT INTO grocery_lists_new SELECT * FROM grocery_lists')

    # Drop old table
    op.execute('DROP TABLE grocery_lists')

    # Rename new table
    op.execute('ALTER TABLE grocery_lists_new RENAME TO grocery_lists')

    # Recreate indexes
    op.create_index('ix_grocery_lists_share_token', 'grocery_lists', ['share_token'], unique=True)
    op.create_index('ix_grocery_lists_user_id', 'grocery_lists', ['user_id'], unique=False)


def downgrade() -> None:
    # Re-add the UNIQUE constraint (this will fail if user has multiple lists)
    op.drop_index('ix_grocery_lists_user_id', table_name='grocery_lists')
    op.drop_index('ix_grocery_lists_share_token', table_name='grocery_lists')

    op.execute('''
        CREATE TABLE grocery_lists_new (
            id VARCHAR NOT NULL,
            user_id VARCHAR NOT NULL,
            name VARCHAR(200),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            share_token VARCHAR(32),
            PRIMARY KEY (id),
            UNIQUE (user_id),
            FOREIGN KEY(user_id) REFERENCES users (id) ON DELETE CASCADE
        )
    ''')

    op.execute('INSERT INTO grocery_lists_new SELECT * FROM grocery_lists')
    op.execute('DROP TABLE grocery_lists')
    op.execute('ALTER TABLE grocery_lists_new RENAME TO grocery_lists')
    op.create_index('ix_grocery_lists_share_token', 'grocery_lists', ['share_token'], unique=True)
