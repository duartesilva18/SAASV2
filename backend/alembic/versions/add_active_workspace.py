"""Modo casal v2: users.active_workspace_id (seletor Pessoal/Partilhado)

Revision ID: add_active_workspace
Revises: add_workspace_sharing
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = 'add_active_workspace'
down_revision = 'add_workspace_sharing'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column('users', sa.Column(
        'active_workspace_id', UUID(as_uuid=True),
        sa.ForeignKey('workspaces.id', ondelete='SET NULL'), nullable=True,
    ))


def downgrade() -> None:
    op.drop_column('users', 'active_workspace_id')
