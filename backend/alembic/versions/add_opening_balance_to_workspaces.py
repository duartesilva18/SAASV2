"""Add opening balance to workspaces table

Revision ID: add_opening_balance_workspaces
Revises: add_language_users
Create Date: 2025-01-27 12:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'add_opening_balance_workspaces'
down_revision: Union[str, None] = 'add_language_users'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Add opening_balance_cents column to workspaces table with default value 0
    op.add_column('workspaces', sa.Column('opening_balance_cents', sa.Integer(), nullable=False, server_default='0'))
    
    # Add opening_balance_date column to workspaces table (nullable)
    op.add_column('workspaces', sa.Column('opening_balance_date', sa.Date(), nullable=True))


def downgrade() -> None:
    # Remove opening_balance columns from workspaces table
    op.drop_column('workspaces', 'opening_balance_date')
    op.drop_column('workspaces', 'opening_balance_cents')

