"""Add MealPlanCalendar model for multiple meal plan calendars

Revision ID: add_meal_calendars
Revises: e4c609c2a526
Create Date: 2026-01-11

This migration:
1. Creates the meal_plan_calendars table
2. Migrates existing meal_plans to use calendars (creates default calendar per user)
3. Updates meal_plan_shares to reference calendars instead of users
"""
from typing import Sequence, Union
import uuid

from alembic import op
import sqlalchemy as sa
from sqlalchemy import text


# revision identifiers, used by Alembic.
revision: str = 'add_meal_calendars'
down_revision: Union[str, None] = 'e4c609c2a526'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    conn = op.get_bind()

    # 1. Create the meal_plan_calendars table
    op.create_table(
        'meal_plan_calendars',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('name', sa.String(200), default='Meal Plan', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )

    # 2. Get all unique user_ids from existing meal_plans
    result = conn.execute(text("SELECT DISTINCT user_id FROM meal_plans"))
    user_ids = [row[0] for row in result]

    # 3. Create a default calendar for each user and build mapping
    user_to_calendar = {}
    for user_id in user_ids:
        calendar_id = str(uuid.uuid4())
        user_to_calendar[user_id] = calendar_id
        conn.execute(
            text("INSERT INTO meal_plan_calendars (id, user_id, name) VALUES (:id, :user_id, :name)"),
            {"id": calendar_id, "user_id": user_id, "name": "Meal Plan"}
        )

    # 4. Add calendar_id column to meal_plans (nullable first for migration)
    op.add_column('meal_plans', sa.Column('calendar_id', sa.String(), nullable=True))

    # 5. Migrate existing meal_plans to use calendar_id
    for user_id, calendar_id in user_to_calendar.items():
        conn.execute(
            text("UPDATE meal_plans SET calendar_id = :calendar_id WHERE user_id = :user_id"),
            {"calendar_id": calendar_id, "user_id": user_id}
        )

    # 6. For SQLite, use batch operations to modify the table
    with op.batch_alter_table('meal_plans', schema=None) as batch_op:
        # Make calendar_id non-nullable
        batch_op.alter_column('calendar_id', existing_type=sa.String(), nullable=False)
        # Drop user_id column
        batch_op.drop_column('user_id')
        # Drop old index and create new one
        batch_op.drop_index('ix_meal_plans_user_date')
        batch_op.create_index('ix_meal_plans_calendar_date', ['calendar_id', 'planned_date'])
        # Add foreign key
        batch_op.create_foreign_key(
            'fk_meal_plans_calendar_id',
            'meal_plan_calendars',
            ['calendar_id'],
            ['id'],
            ondelete='CASCADE'
        )

    # 7. Now update meal_plan_shares table
    # First, get existing shares and map them to calendars
    result = conn.execute(text("SELECT id, owner_id, shared_with_id, permission, created_at FROM meal_plan_shares"))
    existing_shares = list(result)

    # Drop old table and create new one with updated schema
    op.drop_table('meal_plan_shares')

    op.create_table(
        'meal_plan_shares',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('calendar_id', sa.String(), sa.ForeignKey('meal_plan_calendars.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('permission', sa.String(20), default='editor', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('calendar_id', 'user_id', name='uq_meal_plan_calendar_user'),
    )

    # 8. Migrate existing shares (owner_id -> calendar_id)
    for share in existing_shares:
        share_id, owner_id, shared_with_id, permission, created_at = share
        # Get the calendar for this owner
        if owner_id in user_to_calendar:
            calendar_id = user_to_calendar[owner_id]
            conn.execute(
                text("INSERT INTO meal_plan_shares (id, calendar_id, user_id, permission) VALUES (:id, :calendar_id, :user_id, :permission)"),
                {"id": share_id, "calendar_id": calendar_id, "user_id": shared_with_id, "permission": permission}
            )


def downgrade() -> None:
    """Downgrade schema - this is destructive and loses calendar structure."""
    conn = op.get_bind()

    # Get calendar to user mapping before we lose it
    result = conn.execute(text("SELECT id, user_id FROM meal_plan_calendars"))
    calendar_to_user = {row[0]: row[1] for row in result}

    # Get existing shares before dropping
    result = conn.execute(text("SELECT id, calendar_id, user_id, permission FROM meal_plan_shares"))
    existing_shares = list(result)

    # 1. Add user_id back to meal_plans
    op.add_column('meal_plans', sa.Column('user_id', sa.String(), nullable=True))

    # 2. Migrate calendar_id back to user_id
    for calendar_id, user_id in calendar_to_user.items():
        conn.execute(
            text("UPDATE meal_plans SET user_id = :user_id WHERE calendar_id = :calendar_id"),
            {"user_id": user_id, "calendar_id": calendar_id}
        )

    # 3. Modify meal_plans table structure
    with op.batch_alter_table('meal_plans', schema=None) as batch_op:
        batch_op.alter_column('user_id', existing_type=sa.String(), nullable=False)
        batch_op.drop_index('ix_meal_plans_calendar_date')
        batch_op.drop_column('calendar_id')
        batch_op.create_index('ix_meal_plans_user_date', ['user_id', 'planned_date'])
        batch_op.create_foreign_key(
            'fk_meal_plans_user_id',
            'users',
            ['user_id'],
            ['id'],
            ondelete='CASCADE'
        )

    # 4. Recreate old meal_plan_shares structure
    op.drop_table('meal_plan_shares')

    op.create_table(
        'meal_plan_shares',
        sa.Column('id', sa.String(), primary_key=True),
        sa.Column('owner_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('shared_with_id', sa.String(), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('permission', sa.String(20), default='viewer', nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint('owner_id', 'shared_with_id', name='uq_meal_plan_share'),
    )

    # 5. Migrate shares back (calendar_id -> owner_id)
    for share in existing_shares:
        share_id, calendar_id, shared_with_id, permission = share
        if calendar_id in calendar_to_user:
            owner_id = calendar_to_user[calendar_id]
            conn.execute(
                text("INSERT INTO meal_plan_shares (id, owner_id, shared_with_id, permission) VALUES (:id, :owner_id, :shared_with_id, :permission)"),
                {"id": share_id, "owner_id": owner_id, "shared_with_id": shared_with_id, "permission": permission}
            )

    # 6. Drop calendars table
    op.drop_table('meal_plan_calendars')
