"""Add composite index (workspace_id, transaction_date) on transactions

Revision ID: ix_transactions_workspace_date
Revises: add_salary_general_expense_ws
Create Date: 2026-06-30 00:00:00.000000

Índice composto para o padrão de acesso mais comum: filtrar por workspace e
filtrar/ordenar por data. Antes o Postgres só conseguia usar um dos índices simples.
Usa IF NOT EXISTS porque, num DB criado de raiz após a adição do Index ao modelo,
o create_all já o terá criado.
"""
from typing import Sequence, Union

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'ix_transactions_workspace_date'
down_revision: Union[str, None] = 'add_salary_general_expense_ws'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute(
        "CREATE INDEX IF NOT EXISTS ix_transactions_workspace_date "
        "ON transactions (workspace_id, transaction_date)"
    )


def downgrade() -> None:
    op.execute("DROP INDEX IF EXISTS ix_transactions_workspace_date")
