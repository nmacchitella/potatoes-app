"""Add scalable ingredient usages to recipe instructions

Revision ID: add_instruction_usages
Revises: add_recipe_notes
Create Date: 2026-06-13
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'add_instruction_usages'
down_revision: Union[str, Sequence[str], None] = 'add_recipe_notes'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    with op.batch_alter_table('recipe_ingredients') as batch_op:
        batch_op.add_column(sa.Column('key', sa.String(length=100), nullable=True))

    with op.batch_alter_table('recipe_instructions') as batch_op:
        batch_op.add_column(sa.Column('key', sa.String(length=100), nullable=True))
        batch_op.add_column(sa.Column('instruction_template', sa.Text(), nullable=True))

    conn = op.get_bind()
    ingredients = conn.execute(sa.text("SELECT id FROM recipe_ingredients")).fetchall()
    for row in ingredients:
        conn.execute(
            sa.text("UPDATE recipe_ingredients SET key = :key WHERE id = :id"),
            {"key": row.id, "id": row.id},
        )

    instructions = conn.execute(sa.text("SELECT id FROM recipe_instructions")).fetchall()
    for row in instructions:
        conn.execute(
            sa.text("UPDATE recipe_instructions SET key = :key WHERE id = :id"),
            {"key": row.id, "id": row.id},
        )

    with op.batch_alter_table('recipe_ingredients') as batch_op:
        batch_op.alter_column('key', existing_type=sa.String(length=100), nullable=False)
        batch_op.create_unique_constraint('uq_recipe_ingredient_key', ['recipe_id', 'key'])

    with op.batch_alter_table('recipe_instructions') as batch_op:
        batch_op.alter_column('key', existing_type=sa.String(length=100), nullable=False)
        batch_op.create_unique_constraint('uq_recipe_instruction_key', ['recipe_id', 'key'])

    op.create_table(
        'instruction_ingredient_usages',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('instruction_id', sa.String(), nullable=False),
        sa.Column('ingredient_id', sa.String(), nullable=False),
        sa.Column('usage_key', sa.String(length=100), nullable=False),
        sa.Column('quantity', sa.Float(), nullable=False),
        sa.Column('quantity_max', sa.Float(), nullable=True),
        sa.Column('unit', sa.String(length=50), nullable=True),
        sa.Column('base_text', sa.String(length=100), nullable=True),
        sa.Column('sort_order', sa.Integer(), nullable=False, server_default='0'),
        sa.ForeignKeyConstraint(['ingredient_id'], ['recipe_ingredients.id'], ondelete='CASCADE'),
        sa.ForeignKeyConstraint(['instruction_id'], ['recipe_instructions.id'], ondelete='CASCADE'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('instruction_id', 'usage_key', name='uq_instruction_usage_key'),
    )
    op.create_index('ix_instruction_ingredient_usages_instruction_id', 'instruction_ingredient_usages', ['instruction_id'])
    op.create_index('ix_instruction_ingredient_usages_ingredient_id', 'instruction_ingredient_usages', ['ingredient_id'])


def downgrade() -> None:
    op.drop_index('ix_instruction_ingredient_usages_ingredient_id', table_name='instruction_ingredient_usages')
    op.drop_index('ix_instruction_ingredient_usages_instruction_id', table_name='instruction_ingredient_usages')
    op.drop_table('instruction_ingredient_usages')

    with op.batch_alter_table('recipe_instructions') as batch_op:
        batch_op.drop_constraint('uq_recipe_instruction_key', type_='unique')
        batch_op.drop_column('instruction_template')
        batch_op.drop_column('key')

    with op.batch_alter_table('recipe_ingredients') as batch_op:
        batch_op.drop_constraint('uq_recipe_ingredient_key', type_='unique')
        batch_op.drop_column('key')
