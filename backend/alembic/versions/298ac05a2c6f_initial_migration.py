"""Initial migration

Revision ID: 298ac05a2c6f
Revises: 
Create Date: 2026-01-22 20:31:18.181961

"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '298ac05a2c6f'
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # Migração inicial vazia: a BD no Render já foi criada por script SQL.
    # Evita drop_index/drop_table que falham quando os objetos não existem.
    pass


def downgrade() -> None:
    pass

