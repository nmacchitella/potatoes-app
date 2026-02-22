"""Fix schema drift: missing table, columns, indexes, and constraints

Revision ID: fix_schema_drift
Revises: add_meal_calendars
Create Date: 2026-02-21

This migration fixes all critical schema drift issues found in audit:
1. Creates the url_checks table (model exists but no migration created it)
2. Adds recurrence_id column to meal_plans table
3. Adds missing indexes on foreign key columns across multiple tables
4. Adds unique constraint on user_follows(follower_id, following_id)
5. Adds composite indexes for common query patterns on user_follows
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'fix_schema_drift'
down_revision: Union[str, None] = 'add_meal_calendars'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def _index_exists(conn, index_name: str) -> bool:
    """Check if an index exists in SQLite."""
    result = conn.execute(
        sa.text("SELECT 1 FROM sqlite_master WHERE type='index' AND name=:name"),
        {"name": index_name},
    )
    return result.fetchone() is not None


def _table_exists(conn, table_name: str) -> bool:
    """Check if a table exists in SQLite."""
    result = conn.execute(
        sa.text("SELECT 1 FROM sqlite_master WHERE type='table' AND name=:name"),
        {"name": table_name},
    )
    return result.fetchone() is not None


def _column_exists(conn, table_name: str, column_name: str) -> bool:
    """Check if a column exists on a table in SQLite."""
    result = conn.execute(sa.text(f"PRAGMA table_info({table_name})"))
    columns = [row[1] for row in result]
    return column_name in columns


def upgrade() -> None:
    """Upgrade schema to fix all drift issues."""
    conn = op.get_bind()

    # -----------------------------------------------------------------------
    # 1. Create the url_checks table if it doesn't exist
    # -----------------------------------------------------------------------
    if not _table_exists(conn, "url_checks"):
        op.create_table(
            'url_checks',
            sa.Column('url', sa.String(2048), primary_key=True),
            sa.Column('domain', sa.String(255), nullable=False),
            sa.Column('has_recipe', sa.Boolean(), nullable=False, server_default='0'),
            sa.Column('error', sa.String(500), nullable=True),
            sa.Column('checked_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        )
        op.create_index('ix_url_checks_domain', 'url_checks', ['domain'])

    # -----------------------------------------------------------------------
    # 2. Add recurrence_id column to meal_plans if it doesn't exist
    # -----------------------------------------------------------------------
    if not _column_exists(conn, "meal_plans", "recurrence_id"):
        with op.batch_alter_table('meal_plans', schema=None) as batch_op:
            batch_op.add_column(sa.Column('recurrence_id', sa.String(), nullable=True))

        # Create index outside batch (works fine with SQLite)
        op.create_index('ix_meal_plans_recurrence_id', 'meal_plans', ['recurrence_id'])

    # -----------------------------------------------------------------------
    # 3. Add missing indexes on foreign key columns
    # -----------------------------------------------------------------------
    missing_indexes = [
        ('ix_library_shares_inviter_id', 'library_shares', ['inviter_id']),
        ('ix_library_shares_invitee_id', 'library_shares', ['invitee_id']),
        ('ix_meal_plan_calendars_user_id', 'meal_plan_calendars', ['user_id']),
        ('ix_recipe_ingredients_recipe_id', 'recipe_ingredients', ['recipe_id']),
        ('ix_recipe_instructions_recipe_id', 'recipe_instructions', ['recipe_id']),
        ('ix_collection_shares_collection_id', 'collection_shares', ['collection_id']),
        ('ix_collection_shares_user_id', 'collection_shares', ['user_id']),
        ('ix_grocery_list_shares_grocery_list_id', 'grocery_list_shares', ['grocery_list_id']),
        ('ix_grocery_list_shares_user_id', 'grocery_list_shares', ['user_id']),
    ]

    for index_name, table_name, columns in missing_indexes:
        if not _index_exists(conn, index_name):
            op.create_index(index_name, table_name, columns)

    # -----------------------------------------------------------------------
    # 4. Add unique constraint on user_follows(follower_id, following_id)
    # -----------------------------------------------------------------------
    if not _index_exists(conn, "uq_user_follow"):
        with op.batch_alter_table('user_follows', schema=None) as batch_op:
            batch_op.create_unique_constraint('uq_user_follow', ['follower_id', 'following_id'])

    # -----------------------------------------------------------------------
    # 5. Add composite indexes for common query patterns on user_follows
    # -----------------------------------------------------------------------
    if not _index_exists(conn, "ix_user_follows_follower_status"):
        op.create_index(
            'ix_user_follows_follower_status',
            'user_follows',
            ['follower_id', 'status'],
        )

    if not _index_exists(conn, "ix_user_follows_following_status"):
        op.create_index(
            'ix_user_follows_following_status',
            'user_follows',
            ['following_id', 'status'],
        )


def downgrade() -> None:
    """Reverse all schema drift fixes."""
    conn = op.get_bind()

    # 5. Drop composite indexes on user_follows
    if _index_exists(conn, "ix_user_follows_following_status"):
        op.drop_index('ix_user_follows_following_status', table_name='user_follows')

    if _index_exists(conn, "ix_user_follows_follower_status"):
        op.drop_index('ix_user_follows_follower_status', table_name='user_follows')

    # 4. Drop unique constraint on user_follows
    if _index_exists(conn, "uq_user_follow"):
        with op.batch_alter_table('user_follows', schema=None) as batch_op:
            batch_op.drop_constraint('uq_user_follow', type_='unique')

    # 3. Drop missing indexes (reverse order)
    indexes_to_drop = [
        ('ix_grocery_list_shares_user_id', 'grocery_list_shares'),
        ('ix_grocery_list_shares_grocery_list_id', 'grocery_list_shares'),
        ('ix_collection_shares_user_id', 'collection_shares'),
        ('ix_collection_shares_collection_id', 'collection_shares'),
        ('ix_recipe_instructions_recipe_id', 'recipe_instructions'),
        ('ix_recipe_ingredients_recipe_id', 'recipe_ingredients'),
        ('ix_meal_plan_calendars_user_id', 'meal_plan_calendars'),
        ('ix_library_shares_invitee_id', 'library_shares'),
        ('ix_library_shares_inviter_id', 'library_shares'),
    ]

    for index_name, table_name in indexes_to_drop:
        if _index_exists(conn, index_name):
            op.drop_index(index_name, table_name=table_name)

    # 2. Drop recurrence_id column from meal_plans
    if _column_exists(conn, "meal_plans", "recurrence_id"):
        if _index_exists(conn, "ix_meal_plans_recurrence_id"):
            op.drop_index('ix_meal_plans_recurrence_id', table_name='meal_plans')

        with op.batch_alter_table('meal_plans', schema=None) as batch_op:
            batch_op.drop_column('recurrence_id')

    # 1. Drop the url_checks table
    if _table_exists(conn, "url_checks"):
        op.drop_table('url_checks')
