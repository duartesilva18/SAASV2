"""Add language field to users table

Revision ID: add_language_users
Revises: 298ac05a2c6f
Create Date: 2026-01-22 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_language_users'
down_revision: Union[str, None] = '298ac05a2c6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add language column to users table with default value 'pt'
    op.add_column('users', sa.Column('language', sa.String(length=5), nullable=False, server_default='pt'))


def downgrade() -> None:
    # Remove language column from users table
    op.drop_column('users', 'language')

