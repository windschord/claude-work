"""add model selection fields

Revision ID: a8e30604d8b2
Revises: a1b2c3d4e5f6
Create Date: 2025-12-12 13:45:49.590842

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a8e30604d8b2'
down_revision: Union[str, Sequence[str], None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Add default_model column to projects table
    op.add_column('projects', sa.Column('default_model', sa.String(length=64), nullable=False, server_default='claude-sonnet-4-20250514'))

    # Add model column to sessions table
    op.add_column('sessions', sa.Column('model', sa.String(length=64), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    # Remove model column from sessions table
    op.drop_column('sessions', 'model')

    # Remove default_model column from projects table
    op.drop_column('projects', 'default_model')
