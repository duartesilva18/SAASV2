"""Add Salário and Despesas gerais to existing workspaces

Revision ID: add_salary_general_expense_ws
Revises: add_registration_verifications
Create Date: 2026-02-03

Para cada workspace existente, cria as categorias Salário e Despesas gerais
(com o nome na língua do dono) se ainda não existirem.
"""
from typing import Sequence, Union

from alembic import op
from sqlalchemy.orm import Session

revision: str = 'add_salary_general_expense_ws'
down_revision: Union[str, None] = 'add_registration_verifications'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    connection = op.get_bind()
    from app.models import database as models
    from app.routes.auth import ensure_salary_and_general_expense_for_workspace
    from sqlalchemy.orm import joinedload

    session = Session(bind=connection)
    try:
        workspaces = session.query(models.Workspace).options(joinedload(models.Workspace.owner)).all()
        for ws in workspaces:
            user = ws.owner
            if not user:
                continue
            lang = getattr(user, 'language', None) or 'pt'
            if lang not in ('pt', 'en', 'fr'):
                lang = 'pt'
            ensure_salary_and_general_expense_for_workspace(session, ws.id, lang, commit=False)
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


def downgrade() -> None:
    # Não removemos as categorias no downgrade para evitar apagar dados do utilizador
    pass
