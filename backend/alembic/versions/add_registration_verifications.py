"""Add registration_verifications table

Revision ID: add_registration_verifications
Revises: category_mapping_cache_cols
Create Date: 2026-01-27

"""
from typing import Sequence, Union

from alembic import op

revision: str = 'add_registration_verifications'
down_revision: Union[str, None] = 'category_mapping_cache_cols'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Tabela já existe na BD do Render (criada por script SQL).
    pass


def downgrade() -> None:
    pass
