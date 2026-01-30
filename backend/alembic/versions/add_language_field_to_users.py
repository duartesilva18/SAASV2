"""Add language field to users table

Revision ID: add_language_users
Revises: 298ac05a2c6f
Create Date: 2026-01-22 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'add_language_users'
down_revision: Union[str, None] = '298ac05a2c6f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Coluna language já existe na BD do Render (criada por script SQL).
    pass


def downgrade() -> None:
    pass

