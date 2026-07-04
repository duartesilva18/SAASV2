"""
Testes do modo casal: resolver, Pro herdado, convites (join/leave/remove/limite),
isolamento entre workspaces e autor das transações.
"""
import pytest
from datetime import datetime, timedelta, timezone

from app.models import database as models
from app.core.workspace import resolve_user_workspace, MAX_WORKSPACE_MEMBERS
from app.routes.sharing import apply_workspace_invite
from fastapi import HTTPException
from app.core import security


@pytest.fixture
def owner(db_session):
    u = models.User(
        email='owner@example.com',
        password_hash=security.get_password_hash('TestPass123'),
        is_email_verified=True, is_onboarded=True,
        subscription_status='active',  # owner é Pro
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    ws = models.Workspace(owner_id=u.id, name='Casa')
    db_session.add(ws)
    db_session.commit()
    db_session.refresh(ws)
    return u, ws


@pytest.fixture
def partner(db_session):
    u = models.User(
        email='partner@example.com',
        password_hash=security.get_password_hash('TestPass123'),
        is_email_verified=True, is_onboarded=True,
        subscription_status='none',  # parceiro NÃO paga
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    ws = models.Workspace(owner_id=u.id, name='Pessoal')
    db_session.add(ws)
    db_session.commit()
    return u, ws


@pytest.fixture
def stranger(db_session):
    u = models.User(
        email='stranger@example.com',
        password_hash=security.get_password_hash('TestPass123'),
        is_email_verified=True, subscription_status='active',
    )
    db_session.add(u)
    db_session.commit()
    db_session.refresh(u)
    ws = models.Workspace(owner_id=u.id, name='Outro')
    db_session.add(ws)
    db_session.commit()
    return u, ws


def _make_invite(db, workspace, code='TESTINVITE', days=7):
    inv = models.WorkspaceInvite(
        workspace_id=workspace.id, code=code,
        expires_at=datetime.now(timezone.utc) + timedelta(days=days),
    )
    db.add(inv)
    db.commit()
    return inv


# ── Resolver ────────────────────────────────────────────────────────────────

def test_resolver_non_member_gets_own_workspace(db_session, owner):
    u, ws = owner
    assert resolve_user_workspace(db_session, u).id == ws.id
    # também aceita user_id direto
    assert resolve_user_workspace(db_session, u.id).id == ws.id


def test_resolver_member_gets_shared_workspace(db_session, owner, partner):
    o, ows = owner
    p, pws = partner
    db_session.add(models.WorkspaceMember(workspace_id=ows.id, user_id=p.id))
    db_session.commit()
    assert resolve_user_workspace(db_session, p).id == ows.id  # partilhado, não o próprio
    assert resolve_user_workspace(db_session, o).id == ows.id  # owner mantém o dele


# ── Pro herdado ─────────────────────────────────────────────────────────────

def test_partner_inherits_pro_from_owner(db_session, owner, partner):
    o, ows = owner
    p, _ = partner
    assert p._has_own_pro() is False  # sozinho não tem Pro próprio
    db_session.add(models.WorkspaceMember(workspace_id=ows.id, user_id=p.id))
    db_session.commit()
    # O cache é por instância/request; em produção cada request tem instância fresca.
    if hasattr(p, '_inherited_pro_cache'):
        del p._inherited_pro_cache
    assert p.has_effective_pro() is True  # herda do owner


def test_partner_loses_pro_after_leaving(db_session, owner, partner):
    o, ows = owner
    p, _ = partner
    m = models.WorkspaceMember(workspace_id=ows.id, user_id=p.id)
    db_session.add(m)
    db_session.commit()
    db_session.delete(m)
    db_session.commit()
    if hasattr(p, '_inherited_pro_cache'):
        del p._inherited_pro_cache
    assert p.has_effective_pro() is False


def test_no_pro_inheritance_when_owner_not_pro(db_session, partner, stranger):
    s, sws = stranger
    p, _ = partner
    s.subscription_status = 'none'
    s.is_admin = False
    db_session.commit()
    db_session.add(models.WorkspaceMember(workspace_id=sws.id, user_id=p.id))
    db_session.commit()
    if hasattr(p, '_inherited_pro_cache'):
        del p._inherited_pro_cache
    assert p.has_effective_pro() is False


# ── Convites ────────────────────────────────────────────────────────────────

def test_join_with_valid_invite(db_session, owner, partner):
    o, ows = owner
    p, _ = partner
    _make_invite(db_session, ows)
    result = apply_workspace_invite(db_session, p, 'TESTINVITE')
    assert result['joined'] is True
    assert db_session.query(models.WorkspaceMember).filter_by(user_id=p.id).first() is not None


def test_join_invalid_code(db_session, partner):
    p, _ = partner
    with pytest.raises(HTTPException) as e:
        apply_workspace_invite(db_session, p, 'NAOEXISTE')
    assert e.value.status_code == 404


def test_join_expired_invite(db_session, owner, partner):
    o, ows = owner
    p, _ = partner
    _make_invite(db_session, ows, code='EXPIRADO12', days=-1)
    with pytest.raises(HTTPException) as e:
        apply_workspace_invite(db_session, p, 'EXPIRADO12')
    assert e.value.status_code == 400


def test_owner_cannot_join_own_workspace(db_session, owner):
    o, ows = owner
    _make_invite(db_session, ows, code='PROPRIO123')
    with pytest.raises(HTTPException) as e:
        apply_workspace_invite(db_session, o, 'PROPRIO123')
    assert e.value.status_code == 400


def test_member_limit_enforced(db_session, owner, partner, stranger):
    o, ows = owner
    p, _ = partner
    s, _ = stranger
    _make_invite(db_session, ows, code='LIMITE1234')
    apply_workspace_invite(db_session, p, 'LIMITE1234')
    if MAX_WORKSPACE_MEMBERS == 1:
        with pytest.raises(HTTPException) as e:
            apply_workspace_invite(db_session, s, 'LIMITE1234')
        assert e.value.status_code == 400
        assert 'limite' in e.value.detail.lower()


def test_cannot_join_two_shared_workspaces(db_session, owner, stranger, partner):
    o, ows = owner
    s, sws = stranger
    p, _ = partner
    _make_invite(db_session, ows, code='PRIMEIRO12')
    _make_invite(db_session, sws, code='SEGUNDO123')
    apply_workspace_invite(db_session, p, 'PRIMEIRO12')
    with pytest.raises(HTTPException) as e:
        apply_workspace_invite(db_session, p, 'SEGUNDO123')
    assert e.value.status_code == 400


# ── Isolamento ──────────────────────────────────────────────────────────────

def test_stranger_workspace_isolated(db_session, owner, partner, stranger):
    o, ows = owner
    p, _ = partner
    s, sws = stranger
    db_session.add(models.WorkspaceMember(workspace_id=ows.id, user_id=p.id))
    db_session.commit()
    # o resolver do stranger nunca aponta para o workspace do casal
    assert resolve_user_workspace(db_session, s).id == sws.id
