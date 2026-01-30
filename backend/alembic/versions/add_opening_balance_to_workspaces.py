"""Add opening balance to workspaces table

Revision ID: add_opening_balance_workspaces
Revises: add_language_users
Create Date: 2025-01-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'add_opening_balance_workspaces'
down_revision: Union[str, None] = 'add_language_users'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Colunas já existem na BD do Render (criadas por script SQL).
    pass


def downgrade() -> None:
    pass

