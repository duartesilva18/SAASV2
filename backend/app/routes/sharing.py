"""
Modo casal — partilha de workspace.

Owner convida por link (código, expira em 7 dias); o parceiro junta-se com o código
(conta existente) ou ao registar-se com ?winvite=CODE. Limite MAX_WORKSPACE_MEMBERS
além do owner (1 = "um plano para os dois").
"""
import logging
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from ..core.dependencies import get_db
from ..core.config import settings
from ..core.workspace import resolve_user_workspace, MAX_WORKSPACE_MEMBERS
from ..core.audit import log_action
from ..models import database as models
from .auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/workspace/sharing', tags=['sharing'])

INVITE_TTL_DAYS = 7


class JoinRequest(BaseModel):
    code: str = Field(..., min_length=4, max_length=12)


def _generate_invite_code() -> str:
    # 10 chars URL-safe, maiúsculas para facilitar ditar em voz alta
    return secrets.token_urlsafe(8).upper().replace('-', 'A').replace('_', 'B')[:10]


def _invite_link(code: str) -> str:
    return f"{settings.FRONTEND_URL}/auth/register?winvite={code}"


def _active_invite(db: Session, workspace_id):
    now = datetime.now(timezone.utc)
    return db.query(models.WorkspaceInvite).filter(
        models.WorkspaceInvite.workspace_id == workspace_id,
        models.WorkspaceInvite.revoked == False,
        models.WorkspaceInvite.expires_at > now,
    ).order_by(models.WorkspaceInvite.created_at.desc()).first()


def _members_payload(db: Session, workspace) -> list:
    out = []
    owner = db.query(models.User).filter(models.User.id == workspace.owner_id).first()
    if owner:
        out.append({
            'id': str(owner.id), 'name': owner.full_name or owner.email, 'email': owner.email,
            'role': 'owner', 'joined_at': workspace.created_at.isoformat() if workspace.created_at else None,
        })
    memberships = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace.id
    ).all()
    for m in memberships:
        u = db.query(models.User).filter(models.User.id == m.user_id).first()
        if u:
            out.append({
                'id': str(u.id), 'name': u.full_name or u.email, 'email': u.email,
                'role': m.role, 'joined_at': m.created_at.isoformat() if m.created_at else None,
            })
    return out


def apply_workspace_invite(db: Session, user: models.User, code: str) -> dict:
    """Aplica um código de convite a um utilizador. Levanta HTTPException com motivo claro.
    Reutilizado pelo POST /join e pelo fluxo de verificação de registo (?winvite=)."""
    code_clean = (code or '').strip().upper()
    if not code_clean:
        raise HTTPException(status_code=400, detail='Código de convite em falta.')
    now = datetime.now(timezone.utc)
    invite = db.query(models.WorkspaceInvite).filter(
        func.upper(models.WorkspaceInvite.code) == code_clean,
        models.WorkspaceInvite.revoked == False,
    ).first()
    if not invite:
        raise HTTPException(status_code=404, detail='Convite inválido. Pede um link novo a quem te convidou.')
    if invite.expires_at and invite.expires_at <= now:
        raise HTTPException(status_code=400, detail='Este convite expirou. Pede um link novo a quem te convidou.')

    workspace = db.query(models.Workspace).filter(models.Workspace.id == invite.workspace_id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace do convite já não existe.')
    if workspace.owner_id == user.id:
        raise HTTPException(status_code=400, detail='Não podes juntar-te ao teu próprio workspace.')

    existing = db.query(models.WorkspaceMember).filter(models.WorkspaceMember.user_id == user.id).first()
    if existing:
        if existing.workspace_id == workspace.id:
            return {'joined': True, 'already': True, 'workspace_name': workspace.name}
        raise HTTPException(status_code=400, detail='Já pertences a outro workspace partilhado. Sai primeiro desse.')

    member_count = db.query(func.count(models.WorkspaceMember.id)).filter(
        models.WorkspaceMember.workspace_id == workspace.id
    ).scalar() or 0
    if member_count >= MAX_WORKSPACE_MEMBERS:
        raise HTTPException(status_code=400, detail='Este workspace já atingiu o limite de membros do plano.')

    db.add(models.WorkspaceMember(workspace_id=workspace.id, user_id=user.id, role='member'))
    db.commit()
    logger.info('Utilizador %s juntou-se ao workspace %s (convite %s)', user.email, workspace.id, code_clean)
    return {'joined': True, 'already': False, 'workspace_name': workspace.name}


@router.get('')
async def get_sharing_state(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Estado da partilha: membros do workspace efetivo, convite ativo (se owner), papéis."""
    workspace = resolve_user_workspace(db, current_user)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace não encontrado.')
    is_owner = workspace.owner_id == current_user.id
    members = _members_payload(db, workspace)

    invite_payload = None
    if is_owner and len(members) - 1 < MAX_WORKSPACE_MEMBERS:
        inv = _active_invite(db, workspace.id)
        if inv:
            invite_payload = {
                'code': inv.code,
                'link': _invite_link(inv.code),
                'expires_at': inv.expires_at.isoformat() if inv.expires_at else None,
            }
    return {
        'workspace_name': workspace.name,
        'is_owner': is_owner,
        'members': members,
        'member_limit': MAX_WORKSPACE_MEMBERS + 1,  # incluindo o owner
        'invite': invite_payload,
    }


@router.post('/invite')
async def create_invite(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Gera (ou regenera) o link de convite. Só o owner; só se ainda houver vaga."""
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail='Funcionalidade disponível apenas para utilizadores Pro.')
    workspace = resolve_user_workspace(db, current_user)
    if not workspace or workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail='Só o dono do workspace pode convidar.')

    member_count = db.query(func.count(models.WorkspaceMember.id)).filter(
        models.WorkspaceMember.workspace_id == workspace.id
    ).scalar() or 0
    if member_count >= MAX_WORKSPACE_MEMBERS:
        raise HTTPException(status_code=400, detail='O teu plano já tem o número máximo de pessoas.')

    # Revogar convites anteriores (regenerar = link antigo deixa de funcionar)
    db.query(models.WorkspaceInvite).filter(
        models.WorkspaceInvite.workspace_id == workspace.id,
        models.WorkspaceInvite.revoked == False,
    ).update({'revoked': True})

    code = _generate_invite_code()
    while db.query(models.WorkspaceInvite).filter(models.WorkspaceInvite.code == code).first():
        code = _generate_invite_code()
    invite = models.WorkspaceInvite(
        workspace_id=workspace.id,
        code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(days=INVITE_TTL_DAYS),
    )
    db.add(invite)
    db.commit()
    await log_action(db, action='workspace_invite_created', user_id=current_user.id,
                     details=f'Convite {code} para workspace {workspace.id}', request=request)
    return {
        'code': code,
        'link': _invite_link(code),
        'expires_at': invite.expires_at.isoformat(),
    }


@router.post('/join')
async def join_workspace(
    body: JoinRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Conta existente junta-se a um workspace com um código de convite."""
    result = apply_workspace_invite(db, current_user, body.code)
    await log_action(db, action='workspace_joined', user_id=current_user.id,
                     details=f'Juntou-se ao workspace "{result["workspace_name"]}"', request=request)
    return result


@router.post('/leave')
async def leave_workspace(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Membro sai do workspace partilhado (volta ao workspace próprio)."""
    membership = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.user_id == current_user.id
    ).first()
    if not membership:
        raise HTTPException(status_code=400, detail='Não és membro de nenhum workspace partilhado.')
    db.delete(membership)
    db.commit()
    # Garantir que volta a ter workspace próprio
    own = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    if not own:
        own = models.Workspace(owner_id=current_user.id, name='Meu Workspace')
        db.add(own)
        db.commit()
    await log_action(db, action='workspace_left', user_id=current_user.id,
                     details='Saiu do workspace partilhado', request=request)
    return {'ok': True}


@router.delete('/members/{user_id}')
async def remove_member(
    user_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Owner remove um membro do workspace."""
    workspace = resolve_user_workspace(db, current_user)
    if not workspace or workspace.owner_id != current_user.id:
        raise HTTPException(status_code=403, detail='Só o dono do workspace pode remover membros.')
    membership = db.query(models.WorkspaceMember).filter(
        models.WorkspaceMember.workspace_id == workspace.id,
        models.WorkspaceMember.user_id == user_id,
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail='Membro não encontrado.')
    db.delete(membership)
    db.commit()
    await log_action(db, action='workspace_member_removed', user_id=current_user.id,
                     details=f'Removeu o membro {user_id}', request=request)
    return {'ok': True}


@router.get('/stats')
async def get_sharing_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Dashboard do casal: agregados por pessoa (mês corrente, série de 6 meses,
    top categorias por pessoa, últimas transações com autor).
    Transações antigas sem created_by contam para o owner."""
    from datetime import date as d

    workspace = resolve_user_workspace(db, current_user)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace não encontrado.')

    members = _members_payload(db, workspace)
    if len(members) < 2:
        return {'has_partner': False, 'members': members}

    owner_id = workspace.owner_id
    # attribui created_by NULL ao owner (transações históricas)
    author_expr = func.coalesce(models.Transaction.created_by_user_id, owner_id)

    today = d.today()
    month_first = today.replace(day=1)
    six_months_ago = (month_first - timedelta(days=170)).replace(day=1)
    prev_month_last = month_first - timedelta(days=1)
    prev_month_first = prev_month_last.replace(day=1)

    base_filters = [
        models.Transaction.workspace_id == workspace.id,
        models.Transaction.amount_cents < 0,
        func.abs(models.Transaction.amount_cents) != 1,
    ]

    # Mês corrente por pessoa
    month_rows = db.query(
        author_expr.label('author'),
        func.coalesce(func.sum(func.abs(models.Transaction.amount_cents)), 0),
        func.count(models.Transaction.id),
    ).filter(*base_filters,
             models.Transaction.transaction_date >= month_first,
             models.Transaction.transaction_date <= today,
    ).group_by('author').all()
    month_by_person = {str(r[0]): {'expenses_cents': int(r[1]), 'tx_count': int(r[2])} for r in month_rows}

    prev_total = db.query(func.coalesce(func.sum(func.abs(models.Transaction.amount_cents)), 0)).filter(
        *base_filters,
        models.Transaction.transaction_date >= prev_month_first,
        models.Transaction.transaction_date <= prev_month_last,
    ).scalar() or 0

    # Série 6 meses por pessoa
    series_rows = db.query(
        func.to_char(models.Transaction.transaction_date, 'YYYY-MM').label('month'),
        author_expr.label('author'),
        func.coalesce(func.sum(func.abs(models.Transaction.amount_cents)), 0),
    ).filter(*base_filters,
             models.Transaction.transaction_date >= six_months_ago,
    ).group_by('month', 'author').order_by('month').all()
    series: dict = {}
    for month, author, total in series_rows:
        series.setdefault(month, {})[str(author)] = int(total)
    monthly_series = [{'month': m, 'by_person': v} for m, v in sorted(series.items())]

    # Top categorias por pessoa (mês corrente)
    top_rows = db.query(
        author_expr.label('author'),
        models.Category.name,
        func.coalesce(func.sum(func.abs(models.Transaction.amount_cents)), 0).label('total'),
    ).join(models.Category, models.Transaction.category_id == models.Category.id).filter(
        *base_filters,
        models.Transaction.transaction_date >= month_first,
        models.Category.vault_type == 'none',
    ).group_by('author', models.Category.name).order_by(func.sum(func.abs(models.Transaction.amount_cents)).desc()).all()
    top_by_person: dict = {}
    for author, cat_name, total in top_rows:
        lst = top_by_person.setdefault(str(author), [])
        if len(lst) < 3:
            lst.append({'category': cat_name, 'total_cents': int(total)})

    # Últimas transações com autor
    recent = db.query(models.Transaction, models.User.full_name, models.User.email).outerjoin(
        models.User, models.Transaction.created_by_user_id == models.User.id
    ).filter(
        models.Transaction.workspace_id == workspace.id,
        func.abs(models.Transaction.amount_cents) != 1,
    ).order_by(models.Transaction.created_at.desc()).limit(8).all()
    owner_row = next((m for m in members if m['role'] == 'owner'), None)
    recent_payload = []
    for tx, author_name, author_email in recent:
        name = author_name or author_email or (owner_row['name'] if owner_row else None)
        recent_payload.append({
            'id': str(tx.id),
            'description': tx.description,
            'amount_cents': tx.amount_cents,
            'date': tx.transaction_date.isoformat() if tx.transaction_date else None,
            'author_name': name,
        })

    return {
        'has_partner': True,
        'members': members,
        'month': {
            'by_person': month_by_person,
            'total_cents': sum(v['expenses_cents'] for v in month_by_person.values()),
            'prev_month_total_cents': int(prev_total),
        },
        'monthly_series': monthly_series,
        'top_categories_by_person': top_by_person,
        'recent_transactions': recent_payload,
    }
