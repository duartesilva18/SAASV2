"""Category mapping cache: category_name, is_global, nullable workspace_id/category_id

Revision ID: category_mapping_cache_cols
Revises: add_opening_balance_workspaces
Create Date: 2026-01-27

Migração que substitui a lógica em main.py (migrate_category_mapping_cache).
Executar com: alembic upgrade head
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision: str = 'category_mapping_cache_cols'
down_revision: Union[str, None] = 'add_opening_balance_workspaces'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    conn = op.get_bind()
    # Só alterar se a tabela existir (evitar falha em ambientes sem esta tabela)
    result = conn.execute(sa.text(
        "SELECT 1 FROM information_schema.tables WHERE table_name = 'category_mapping_cache'"
    ))
    if not result.scalar():
        return

    # PostgreSQL: ADD COLUMN IF NOT EXISTS (idempotente)
    conn.execute(sa.text("""
        ALTER TABLE category_mapping_cache
        ADD COLUMN IF NOT EXISTS category_name VARCHAR(100) NOT NULL DEFAULT 'Outros'
    """))
    conn.execute(sa.text("""
        ALTER TABLE category_mapping_cache
        ADD COLUMN IF NOT EXISTS is_global BOOLEAN NOT NULL DEFAULT FALSE
    """))

    # Remover constraint antigo se existir
    conn.execute(sa.text(
        "ALTER TABLE category_mapping_cache DROP CONSTRAINT IF EXISTS unique_mapping"
    ))

    # workspace_id e category_id nullable
    op.alter_column(
        'category_mapping_cache',
        'workspace_id',
        existing_type=sa.dialects.postgresql.UUID(),
        nullable=True,
    )
    op.alter_column(
        'category_mapping_cache',
        'category_id',
        existing_type=sa.dialects.postgresql.UUID(),
        nullable=True,
    )

    # Garantir constraint único (permite NULL em workspace_id)
    conn.execute(sa.text("""
        DO $$
        BEGIN
            IF NOT EXISTS (
                SELECT 1 FROM information_schema.table_constraints
                WHERE table_name = 'category_mapping_cache' AND constraint_name = 'unique_workspace_mapping'
            ) THEN
                ALTER TABLE category_mapping_cache
                ADD CONSTRAINT unique_workspace_mapping
                UNIQUE (workspace_id, description_normalized, transaction_type);
            END IF;
        END $$
    """))

    # Preencher category_name a partir de categories onde ainda está 'Outros'
    conn.execute(sa.text("""
        UPDATE category_mapping_cache c
        SET category_name = (SELECT cat.name FROM categories cat WHERE cat.id = c.category_id)
        WHERE c.category_name = 'Outros' AND c.category_id IS NOT NULL
    """))


def downgrade() -> None:
    # Reverter para NOT NULL e remover colunas adicionadas seria destrutivo.
    # Manter sem downgrade automático; se precisar, criar migração específica.
    pass
