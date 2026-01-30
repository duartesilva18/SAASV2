"""Add registration_verifications table

Revision ID: add_registration_verifications
Revises: category_mapping_cache_cols
Create Date: 2026-01-27

Tabela para códigos de 6 dígitos enviados por email no fluxo de registo
(confirmar email antes de criar o utilizador).
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID

revision: str = 'add_registration_verifications'
down_revision: Union[str, None] = 'category_mapping_cache_cols'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'registration_verifications',
        sa.Column('id', UUID(as_uuid=True), primary_key=True, server_default=sa.text('gen_random_uuid()')),
        sa.Column('email', sa.String(), nullable=False, index=True),
        sa.Column('password_hash', sa.String(), nullable=False),
        sa.Column('language', sa.String(5), nullable=False, server_default='pt'),
        sa.Column('referral_code', sa.String(20), nullable=True),
        sa.Column('code', sa.String(6), nullable=False),
        sa.Column('expires_at', sa.DateTime(timezone=True), nullable=False),
        sa.Column('is_used', sa.Boolean(), nullable=False, server_default='false'),
        sa.Column('created_at', sa.DateTime(timezone=True), nullable=False, server_default=sa.text('NOW()')),
    )


def downgrade() -> None:
    op.drop_table('registration_verifications')
