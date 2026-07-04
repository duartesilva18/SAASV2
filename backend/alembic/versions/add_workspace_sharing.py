"""Modo casal: workspace_members, workspace_invites e transactions.created_by_user_id

Revision ID: add_workspace_sharing
Revises: ix_transactions_workspace_date
"""
import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID

revision = 'add_workspace_sharing'
down_revision = 'ix_transactions_workspace_date'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'workspace_members',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('user_id', UUID(as_uuid=True), sa.ForeignKey('users.id', ondelete='CASCADE'), nullable=False),
        sa.Column('role', sa.String(20), nullable=False, server_default='member'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_workspace_members_workspace_id', 'workspace_members', ['workspace_id'])
    op.create_index('ix_workspace_members_user_id', 'workspace_members', ['user_id'], unique=True)

    op.create_table(
        'workspace_invites',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('workspace_id', UUID(as_uuid=True), sa.ForeignKey('workspaces.id', ondelete='CASCADE'), nullable=False),
        sa.Column('code', sa.String(12), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('revoked', sa.Boolean(), nullable=False, server_default=sa.false()),
    )
    op.create_index('ix_workspace_invites_workspace_id', 'workspace_invites', ['workspace_id'])
    op.create_index('ix_workspace_invites_code', 'workspace_invites', ['code'], unique=True)

    op.add_column('transactions', sa.Column(
        'created_by_user_id', UUID(as_uuid=True),
        sa.ForeignKey('users.id', ondelete='SET NULL'), nullable=True,
    ))


def downgrade() -> None:
    op.drop_column('transactions', 'created_by_user_id')
    op.drop_index('ix_workspace_invites_code', table_name='workspace_invites')
    op.drop_index('ix_workspace_invites_workspace_id', table_name='workspace_invites')
    op.drop_table('workspace_invites')
    op.drop_index('ix_workspace_members_user_id', table_name='workspace_members')
    op.drop_index('ix_workspace_members_workspace_id', table_name='workspace_members')
    op.drop_table('workspace_members')
