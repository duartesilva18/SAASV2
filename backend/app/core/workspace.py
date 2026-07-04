"""
Resolução central user → workspace (modo casal).

Regra v1: se o utilizador for membro aceite de um workspace partilhado, ESSE é o
workspace dele para tudo (web, bot, copilot). Senão, o workspace próprio (owner).
Sem seletor de workspaces — um único workspace implícito por utilizador.
"""
from ..models import database as models

# Limite de membros além do owner. 1 = estritamente modo casal (1 plano = 2 pessoas).
# Subir quando existir um plano "Família" pago.
MAX_WORKSPACE_MEMBERS = 1


def resolve_user_workspace(db, user):
    """Workspace efetivo do utilizador: partilhado (se membro) > próprio (owner).

    Aceita o objeto User ou diretamente o user_id (os call sites migrados passam ambos)."""
    if user is None:
        return None
    user_id = getattr(user, 'id', user)
    membership = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.user_id == user_id
    ).first()
    if membership:
        ws = db.query(models.Workspace).filter(models.Workspace.id == membership.workspace_id).first()
        if ws:
            return ws
    return (
        db.query(models.Workspace)
        .filter(models.Workspace.owner_id == user_id)
        .order_by(models.Workspace.created_at)
        .first()
    )


def get_workspace_member_users(db, workspace) -> list:
    """Todos os utilizadores com acesso ao workspace: owner primeiro, depois membros."""
    users = []
    owner = db.query(models.User).filter(models.User.id == workspace.owner_id).first()
    if owner:
        users.append(owner)
    memberships = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace.id
    ).all()
    for m in memberships:
        u = db.query(models.User).filter(models.User.id == m.user_id).first()
        if u:
            users.append(u)
    return users


def is_workspace_owner(user, workspace) -> bool:
    return workspace is not None and workspace.owner_id == user.id
