from fastapi import APIRouter, Depends, HTTPException, status, Request, Query, BackgroundTasks
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, desc, case, or_
from typing import List, Optional, Dict, Set
from uuid import UUID
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
from ..core.dependencies import get_db, conf
from ..models import database as models
from .. import schemas
from .auth import get_current_user
from ..core.audit import log_action
from ..core.affiliate_commission import get_commission_percentage_for_price_id
import stripe
from ..core.config import settings
from fastapi_mail import FastMail, MessageSchema, MessageType
from ..core.email_translations import get_email_translation
import logging
import requests
import secrets
import re

import json

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_API_KEY

router = APIRouter(prefix='/admin', tags=['admin'])

# Cache em memória para evitar chamadas repetidas ao Stripe em cada refresh do admin.
# Estrutura: {customer_id: {"value": bool, "ts": epoch_seconds}}
_customer_card_cache: Dict[str, Dict[str, float]] = {}
_CUSTOMER_CARD_CACHE_TTL_SECONDS = 15 * 60
_CUSTOMER_CARD_CACHE_MAX_ENTRIES = 5000

# Cache do resultado de /finance/stats (chamadas Stripe caras) — TTL 5 min.
_finance_stats_cache: Dict[str, float] = {"value": None, "ts": 0.0}
_FINANCE_STATS_TTL_SECONDS = 5 * 60

async def check_admin(current_user: models.User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail='Acesso negado. Apenas administradores.'
        )
    return current_user

def _invoice_net_paid(inv) -> int:
    """Receita líquida da fatura (amount_paid menos reembolsos)."""
    if getattr(inv, 'status', None) != 'paid':
        return 0
    amount_paid = getattr(inv, 'amount_paid', 0) or 0
    charge = getattr(inv, 'charge', None)
    if not charge:
        return amount_paid
    # charge pode ser id (string) ou objeto expandido
    if isinstance(charge, str):
        try:
            charge = stripe.Charge.retrieve(charge)
        except Exception:
            return amount_paid
    amount_refunded = getattr(charge, 'amount_refunded', 0) or 0
    return max(0, amount_paid - amount_refunded)


def _audit_severity(action: str, details: Optional[str]) -> str:
    text_action = (action or '').lower()
    text_details = details or ''
    m = re.search(r'->\s*(\d{3})', text_details)
    if m:
        status_code = int(m.group(1))
        if status_code >= 500:
            return 'critical'
        if status_code >= 400:
            return 'warning'
    if any(k in text_action for k in ('delete', 'revoke', 'refund', 'error', 'failed', 'deny', 'blocked')):
        return 'warning'
    return 'info'


from ..core.stripe_utils import customer_has_saved_card as _customer_has_saved_card


def _get_cached_customer_card_status(customer_id: str) -> Optional[bool]:
    if not customer_id:
        return None
    entry = _customer_card_cache.get(customer_id)
    if not entry:
        return None
    ts = float(entry.get('ts', 0))
    if (time.time() - ts) > _CUSTOMER_CARD_CACHE_TTL_SECONDS:
        _customer_card_cache.pop(customer_id, None)
        return None
    return bool(entry.get('value', False))


def _set_cached_customer_card_status(customer_id: str, value: bool) -> None:
    if not customer_id:
        return
    # Limpeza simples para evitar crescimento infinito.
    if len(_customer_card_cache) >= _CUSTOMER_CARD_CACHE_MAX_ENTRIES:
        now = time.time()
        expired_keys = [
            key for key, entry in _customer_card_cache.items()
            if (now - float(entry.get('ts', 0))) > _CUSTOMER_CARD_CACHE_TTL_SECONDS
        ]
        for key in expired_keys[:2000]:
            _customer_card_cache.pop(key, None)
        if len(_customer_card_cache) >= _CUSTOMER_CARD_CACHE_MAX_ENTRIES:
            _customer_card_cache.pop(next(iter(_customer_card_cache)), None)
    _customer_card_cache[customer_id] = {'value': bool(value), 'ts': time.time()}


def _invoice_commission_is_settled(invoice_id: str, affiliate_id, stripe_invoice_cache: Dict[str, bool]) -> bool:
    """
    Considera uma invoice liquidada para comissões quando:
    - já existe registo de transferência manual por invoice, ou
    - Stripe indica split automático (charge.transfer ou application_fee_amount > 0).
    """
    if not invoice_id:
        return False
    cached = stripe_invoice_cache.get(invoice_id)
    if cached is not None:
        return cached
    if not settings.STRIPE_API_KEY:
        stripe_invoice_cache[invoice_id] = False
        return False
    try:
        invoice = stripe.Invoice.retrieve(invoice_id, expand=['charge'])
        charge = invoice.get('charge') if isinstance(invoice, dict) else getattr(invoice, 'charge', None)
        if isinstance(charge, dict):
            settled = bool(charge.get('transfer')) or (charge.get('application_fee_amount') or 0) > 0
        else:
            settled = bool(getattr(charge, 'transfer', None)) or (getattr(charge, 'application_fee_amount', 0) or 0) > 0
        stripe_invoice_cache[invoice_id] = bool(settled)
        return bool(settled)
    except Exception as e:
        logger.warning(f'Erro ao validar settlement da invoice {invoice_id} (afiliado {affiliate_id}): {e}')
        stripe_invoice_cache[invoice_id] = False
        return False


def _get_pending_commission_cents_for_month(
    db: Session,
    affiliate_id,
    month_date: date,
    monthly_commission_cents: int,
    stripe_invoice_cache: Dict[str, bool],
) -> int:
    """
    Calcula comissão pendente no mês com granularidade por invoice.
    Evita pagar em duplicado meses parcialmente liquidados.
    """
    invoice_rows = (
        db.query(models.AffiliateCommissionInvoice)
        .filter(
            models.AffiliateCommissionInvoice.affiliate_id == affiliate_id,
            models.AffiliateCommissionInvoice.month == month_date,
        )
        .all()
    )
    if not invoice_rows:
        return max(0, int(monthly_commission_cents or 0))

    pending = 0
    for row in invoice_rows:
        manual_done = db.query(models.AffiliateInvoiceManualTransfer).filter(
            models.AffiliateInvoiceManualTransfer.invoice_id == row.invoice_id
        ).first()
        if manual_done:
            continue
        if _invoice_commission_is_settled(row.invoice_id, affiliate_id, stripe_invoice_cache):
            continue
        pending += int(row.commission_cents or 0)
    return max(0, pending)


@router.get('/finance/stats')
async def get_admin_finance_stats(db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    try:
        from datetime import datetime, timedelta
        from collections import defaultdict

        if not settings.STRIPE_API_KEY:
            now = datetime.now(timezone.utc)
            monthly_data = []
            for i in range(11, -1, -1):
                month_date = now - timedelta(days=30 * i)
                monthly_data.append({
                    'month': month_date.strftime('%b %Y'),
                    'revenue_cents': 0
                })
            return {
                'total_mrr_cents': 0,
                'total_revenue_cents': 0,
                'active_subscriptions': 0,
                'pending_invoices_count': 0,
                'monthly_revenue': monthly_data
            }

        # Servir do cache se ainda fresco (evita 2+ chamadas Stripe por cada carregamento).
        if _finance_stats_cache["value"] is not None and (time.time() - _finance_stats_cache["ts"]) < _FINANCE_STATS_TTL_SECONDS:
            return _finance_stats_cache["value"]

        subscriptions = stripe.Subscription.list(limit=100, status='all')
        # Expandir charge para obter amount_refunded sem N+1 requests
        invoices = stripe.Invoice.list(limit=100, expand=['data.charge'])

        # MRR: apenas subscrições ativas ou em trial
        total_mrr = sum(
            sub.plan.amount for sub in subscriptions.data
            if sub.plan and sub.status in ('active', 'trialing')
        )
        # Receita total: apenas valor líquido (excluir reembolsos)
        total_revenue = sum(_invoice_net_paid(inv) for inv in invoices.data)

        pending_invoices = [inv for inv in invoices.data if inv.status == 'open' and inv.attempt_count > 0]

        # Contar apenas utilizadores únicos com subscrições ativas (não subscrições múltiplas)
        unique_customers = set()
        for sub in subscriptions.data:
            if sub.status in ['active', 'trialing']:
                unique_customers.add(sub.customer)

        # Faturamento mensal dos últimos 12 meses (receita líquida, sem reembolsos)
        monthly_revenue = defaultdict(int)
        now = datetime.now(timezone.utc)

        for inv in invoices.data:
            if inv.status == 'paid' and inv.created:
                net = _invoice_net_paid(inv)
                if net <= 0:
                    continue
                if isinstance(inv.created, (int, float)):
                    inv_date = datetime.fromtimestamp(inv.created, tz=timezone.utc)
                else:
                    inv_date = inv.created
                month_key = inv_date.strftime('%Y-%m')
                monthly_revenue[month_key] += net

        monthly_data = []
        for i in range(11, -1, -1):
            month_date = now - timedelta(days=30 * i)
            month_key = month_date.strftime('%Y-%m')
            month_label = month_date.strftime('%b %Y')
            monthly_data.append({
                'month': month_label,
                'revenue_cents': monthly_revenue.get(month_key, 0)
            })

        result = {
            'total_mrr_cents': total_mrr,
            'total_revenue_cents': total_revenue,
            'active_subscriptions': len(unique_customers),
            'pending_invoices_count': len(pending_invoices),
            'monthly_revenue': monthly_data
        }
        _finance_stats_cache["value"] = result
        _finance_stats_cache["ts"] = time.time()
        return result
    except Exception as e:
        logger.error(f'Erro em /admin/finance/stats: {str(e)}', exc_info=True)
        raise HTTPException(status_code=500, detail='Erro ao obter estatísticas financeiras.')

@router.get('/stats', response_model=schemas.AdminStats)
async def get_admin_stats(db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    total_users = db.query(func.count(models.User.id)).scalar()
    total_transactions = db.query(func.count(models.Transaction.id)).scalar()
    total_recurring = db.query(func.count(models.RecurringTransaction.id)).scalar()

    # Subscrições ativas reais: apenas utilizadores com subscrição Stripe ativa/trial
    # e que nunca tiveram reembolso (had_refund = FALSE). Admin/Pro concedido não contam aqui.
    active_subscriptions = (
        db.query(func.count(models.User.id))
        .filter(
            models.User.subscription_status.in_(['active', 'trialing', 'cancel_at_period_end']),
            models.User.had_refund == False,
        )
        .scalar()
    )

    total_visits = db.query(func.sum(models.User.login_count)).scalar() or 0
    # No longer returning recent logs here to avoid confusion with paginated ones
    
    return schemas.AdminStats(
        total_users=total_users,
        total_transactions=total_transactions,
        total_recurring=total_recurring,
        active_subscriptions=active_subscriptions,
        total_visits=total_visits,
        recent_logs=[]
    )

# --- Despesas do projeto e manutenção ---
@router.get('/health')
async def get_health_dashboard(db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    """Dashboard de saúde: estado das integrações e últimos erros."""
    from ..core.error_buffer import get_recent_errors_from_db
    from sqlalchemy import text

    integrations = []

    # Base de dados
    db_ok = False
    db_msg = ""
    try:
        db.execute(text("SELECT 1"))
        db_ok = True
        db_msg = "Conectado"
    except Exception as e:
        db_msg = str(e)[:200]

    integrations.append({"name": "Base de Dados", "status": "ok" if db_ok else "error", "message": db_msg, "icon": "database"})

    # Stripe
    stripe_ok = False
    stripe_msg = ""
    if settings.STRIPE_API_KEY:
        try:
            stripe.Balance.retrieve()
            stripe_ok = True
            stripe_msg = "API operacional"
        except Exception as e:
            stripe_msg = str(e)[:200]
    else:
        stripe_msg = "Chave não configurada"

    integrations.append({"name": "Stripe", "status": "ok" if stripe_ok else ("skipped" if not settings.STRIPE_API_KEY else "error"), "message": stripe_msg, "icon": "stripe"})

    # Email (SMTP)
    mail_ok = False
    mail_msg = ""
    mail_configured = bool(
        settings.MAIL_SERVER
        and settings.MAIL_USERNAME
        and settings.MAIL_PASSWORD
        and "placeholder" not in (settings.MAIL_USERNAME or "").lower()
        and settings.MAIL_PASSWORD != "password"
    )
    if mail_configured:
        try:
            import smtplib
            if settings.MAIL_SSL_TLS:
                smtp = smtplib.SMTP_SSL(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=5)
            else:
                smtp = smtplib.SMTP(settings.MAIL_SERVER, settings.MAIL_PORT, timeout=5)
                if settings.MAIL_STARTTLS:
                    smtp.starttls()
            smtp.login(settings.MAIL_USERNAME, settings.MAIL_PASSWORD)
            smtp.quit()
            mail_ok = True
            mail_msg = "SMTP operacional"
        except Exception as e:
            mail_msg = str(e)[:200]
    else:
        mail_msg = "Configuração não definida (MAIL_SERVER, MAIL_USERNAME, MAIL_PASSWORD)"

    integrations.append({
        "name": "Email",
        "status": "ok" if mail_ok else ("skipped" if not mail_configured else "error"),
        "message": mail_msg,
        "icon": "mail"
    })

    # OpenAI (verifica chave com chamada mínima)
    openai_ok = False
    openai_msg = ""
    if settings.OPENAI_API_KEY:
        try:
            from openai import OpenAI
            client = OpenAI(api_key=settings.OPENAI_API_KEY)
            list(client.models.list())  # consome para verificar a chave
            openai_ok = True
            openai_msg = "API operacional (chave válida)"
        except Exception as e:
            openai_msg = str(e)[:200]
    else:
        openai_msg = "Chave não configurada"

    integrations.append({
        "name": "OpenAI",
        "status": "ok" if openai_ok else ("skipped" if not settings.OPENAI_API_KEY else "error"),
        "message": openai_msg,
        "icon": "openai"
    })

    # Telegram
    telegram_ok = False
    telegram_msg = ""
    if settings.TELEGRAM_BOT_TOKEN:
        telegram_ok = True
        telegram_msg = "Bot token configurado"
        if settings.TELEGRAM_WEBHOOK_SECRET:
            telegram_msg = "Bot token e webhook configurados"
    else:
        telegram_msg = "Token não configurado"

    integrations.append({
        "name": "Telegram",
        "status": "ok" if telegram_ok else "skipped",
        "message": telegram_msg,
        "icon": "telegram"
    })

    # Erros recentes (BD)
    recent_errors = get_recent_errors_from_db(db, limit=20)

    return {
        "integrations": integrations,
        "recent_errors": recent_errors,
    }


@router.post('/health/clear-errors')
async def clear_health_errors(db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    """Limpa os erros recentes da BD e memória."""
    from ..core.error_buffer import clear_memory_errors

    db.query(models.AdminErrorLog).delete()
    db.commit()
    clear_memory_errors()
    return {"message": "Erros limpos."}


@router.get('/project-expenses')
async def get_project_expenses(db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    """Lista todas as despesas do projeto (apenas admins)."""
    rows = db.query(models.AdminProjectExpense).order_by(models.AdminProjectExpense.expense_date.desc()).all()
    return [
        {
            "id": str(r.id),
            "description": r.description,
            "amount_cents": r.amount_cents,
            "date": r.expense_date.isoformat() if r.expense_date else None,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        }
        for r in rows
    ]


@router.post('/project-expenses')
async def create_project_expense(
    data: schemas.ProjectExpenseCreate,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin),
):
    """Adiciona uma despesa do projeto."""
    expense_date = data.expense_date or date.today()
    exp = models.AdminProjectExpense(
        created_by_id=admin.id,
        description=data.description.strip(),
        amount_cents=data.amount_cents,
        expense_date=expense_date,
    )
    db.add(exp)
    db.commit()
    db.refresh(exp)
    await log_action(db, action='project_expense_create', user_id=admin.id, details=f'Despesa: {data.description}', request=request)
    return {"id": str(exp.id), "description": exp.description, "amount_cents": exp.amount_cents, "date": exp.expense_date.isoformat(), "created_at": exp.created_at.isoformat()}


@router.delete('/project-expenses/{expense_id}')
async def delete_project_expense(
    expense_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin),
):
    """Remove uma despesa do projeto."""
    exp = db.query(models.AdminProjectExpense).filter(models.AdminProjectExpense.id == expense_id).first()
    if not exp:
        raise HTTPException(status_code=404, detail="Despesa não encontrada.")
    db.delete(exp)
    db.commit()
    await log_action(db, action='project_expense_delete', user_id=admin.id, details=f'Removida despesa: {exp.description}', request=request)
    return {"message": "Despesa removida."}


@router.get('/audit-logs')
async def get_audit_logs(
    page: int = 1, 
    limit: int = 20, 
    action: str = None, 
    q: Optional[str] = None,
    user_id: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    db: Session = Depends(get_db), 
    admin: models.User = Depends(check_admin)
):
    limit = min(max(limit, 1), 100)  # Cap entre 1 e 100
    page = max(page, 1)
    query = db.query(models.AuditLog).options(joinedload(models.AuditLog.user))
    
    if action and action != 'all':
        query = query.filter(models.AuditLog.action.contains(action))
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.AuditLog.action.ilike(term),
                models.AuditLog.details.ilike(term),
                models.AuditLog.ip_address.ilike(term),
            )
        )
    if user_id:
        try:
            uid = UUID(user_id)
            query = query.filter(models.AuditLog.user_id == uid)
        except Exception:
            raise HTTPException(status_code=400, detail='user_id inválido')
    if date_from:
        try:
            from_dt = datetime.fromisoformat(date_from)
            query = query.filter(models.AuditLog.created_at >= from_dt)
        except Exception:
            raise HTTPException(status_code=400, detail='date_from inválido (ISO esperado)')
    if date_to:
        try:
            to_dt = datetime.fromisoformat(date_to)
            query = query.filter(models.AuditLog.created_at <= to_dt)
        except Exception:
            raise HTTPException(status_code=400, detail='date_to inválido (ISO esperado)')
        
    total = query.count()
    logs = query.order_by(models.AuditLog.created_at.desc()).offset((page - 1) * limit).limit(limit).all()

    logs_payload = []
    for log in logs:
        user = log.user
        logs_payload.append(
            {
                "id": str(log.id),
                "user_id": log.user_id,
                "user_email": user.email if user else None,
                "action": log.action,
                "details": log.details,
                "ip_address": log.ip_address,
                "severity": _audit_severity(log.action, log.details),
                "created_at": log.created_at,
            }
        )

    return {
        "logs": logs_payload,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }


@router.get('/users/{user_id}/logs')
async def get_user_logs(
    user_id: UUID,
    page: int = 1,
    limit: int = 20,
    action: Optional[str] = None,
    q: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin),
):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')

    limit = min(max(limit, 1), 100)
    page = max(page, 1)
    query = db.query(models.AuditLog).filter(models.AuditLog.user_id == user_id)
    if action and action != 'all':
        query = query.filter(models.AuditLog.action.contains(action))
    if q:
        term = f"%{q.strip()}%"
        query = query.filter(
            or_(
                models.AuditLog.action.ilike(term),
                models.AuditLog.details.ilike(term),
                models.AuditLog.ip_address.ilike(term),
            )
        )

    total = query.count()
    logs = query.order_by(models.AuditLog.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    return {
        "logs": [
            {
                "id": str(log.id),
                "user_id": str(log.user_id) if log.user_id else None,
                "action": log.action,
                "details": log.details,
                "ip_address": log.ip_address,
                "severity": _audit_severity(log.action, log.details),
                "created_at": log.created_at,
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@router.get('/users', response_model=List[schemas.AdminUserResponse])
async def get_admin_users(db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    """
    Lista utilizadores com métricas agregadas (inclui contagem de transações criadas via bot/Telegram).
    Consideramos como "via bot" as transações nos workspaces do utilizador que passaram pelo fluxo do bot,
    identificadas por:
      - inference_source não nulo (setado apenas nos fluxos automáticos: Telegram/AI/vision), ou
      - decision_reason a conter 'telegram', ou
      - descrição padrão 'Transação Telegram'.
    """
    # Subquery: métricas de transações por owner_id (total, via bot, última via bot)
    _is_bot_tx = or_(
        models.Transaction.inference_source.isnot(None),
        models.Transaction.decision_reason.ilike('%telegram%'),
        models.Transaction.description == 'Transação Telegram',
    )
    tx_bot_subq = (
        db.query(
            models.Workspace.owner_id.label('owner_id'),
            func.coalesce(func.sum(case((_is_bot_tx, 1), else_=0)), 0).label('bot_transactions_count'),
            func.count(models.Transaction.id).label('total_transactions'),
            func.max(case((_is_bot_tx, models.Transaction.created_at), else_=None)).label('last_bot_tx_at'),
        )
        .outerjoin(models.Transaction, models.Transaction.workspace_id == models.Workspace.id)
        .group_by(models.Workspace.owner_id)
        .subquery()
    )

    # Subquery: copilot messages count per user
    copilot_subq = (
        db.query(
            models.CopilotConversation.user_id.label('user_id'),
            func.count(models.CopilotMessage.id).label('copilot_msg_count'),
        )
        .join(models.CopilotMessage, models.CopilotMessage.conversation_id == models.CopilotConversation.id)
        .filter(models.CopilotMessage.role == 'user')
        .group_by(models.CopilotConversation.user_id)
        .subquery()
    )

    rows = (
        db.query(
            models.User,
            func.coalesce(tx_bot_subq.c.bot_transactions_count, 0).label('bot_transactions_count'),
            func.coalesce(copilot_subq.c.copilot_msg_count, 0).label('copilot_msg_count'),
            func.coalesce(tx_bot_subq.c.total_transactions, 0).label('total_transactions'),
            tx_bot_subq.c.last_bot_tx_at.label('last_bot_tx_at'),
        )
        .outerjoin(tx_bot_subq, tx_bot_subq.c.owner_id == models.User.id)
        .outerjoin(copilot_subq, copilot_subq.c.user_id == models.User.id)
        .order_by(models.User.created_at.desc())
        .all()
    )

    users_with_metrics: List[schemas.AdminUserResponse] = []
    customer_ids: Set[str] = set()
    for user, *_ in rows:
        customer_id = (user.stripe_customer_id or '').strip() if user.stripe_customer_id else ''
        if customer_id:
            customer_ids.add(customer_id)

    # Resolve apenas customers sem cache/expirados.
    resolved_cards: Dict[str, bool] = {}
    missing_customer_ids: List[str] = []
    for customer_id in customer_ids:
        cached_value = _get_cached_customer_card_status(customer_id)
        if cached_value is None:
            missing_customer_ids.append(customer_id)
        else:
            resolved_cards[customer_id] = cached_value

    if missing_customer_ids:
        max_workers = min(8, len(missing_customer_ids))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(_customer_has_saved_card, customer_id): customer_id
                for customer_id in missing_customer_ids
            }
            for future in as_completed(futures):
                customer_id = futures[future]
                try:
                    has_card = bool(future.result())
                except Exception as e:
                    logger.warning(f'Erro ao resolver customer {customer_id}: {e}')
                    has_card = False
                resolved_cards[customer_id] = has_card
                _set_cached_customer_card_status(customer_id, has_card)

    for user, bot_tx_count, copilot_count, total_tx, last_bot_tx in rows:
        base = schemas.AdminUserResponse.from_orm(user).dict()
        base['bot_transactions_count'] = int(bot_tx_count or 0)
        base['copilot_messages_count'] = int(copilot_count or 0)
        base['total_transactions'] = int(total_tx or 0)
        base['last_bot_tx_at'] = last_bot_tx
        base['had_trial'] = bool(user.had_trial)
        customer_id = (user.stripe_customer_id or '').strip() if user.stripe_customer_id else ''
        base['has_stripe_customer'] = bool(customer_id)

        if not customer_id:
            base['has_payment_method'] = False
        else:
            base['has_payment_method'] = bool(resolved_cards.get(customer_id, False))
        users_with_metrics.append(schemas.AdminUserResponse(**base))

    return users_with_metrics


@router.post('/reconcile-subscriptions')
async def admin_reconcile_subscriptions(db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    """
    Força a reconciliação dos estados de subscrição com o Stripe (rede de segurança para
    webhooks perdidos). Corre normalmente como job diário; este endpoint permite acioná-lo
    a pedido. Sincroniza apenas estados em trânsito (trial, past_due, etc.).
    """
    from ..webhooks.stripe import reconcile_subscriptions
    result = reconcile_subscriptions(db)
    return {"message": "Reconciliação concluída", **result}


@router.get('/users/{user_id}', response_model=schemas.AdminUserFullDetail)
async def get_user_detail(user_id: UUID, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    """Ficha completa do utilizador: conta, subscrição (Stripe em tempo real), Telegram, utilização e afiliado."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')

    ws_ids = [w.id for w in db.query(models.Workspace.id).filter(models.Workspace.owner_id == user_id).all()]
    ws_ids = [w[0] if isinstance(w, tuple) else w for w in ws_ids]

    # Utilização (transações dos workspaces do user)
    is_bot_tx = or_(
        models.Transaction.inference_source.isnot(None),
        models.Transaction.decision_reason.ilike('%telegram%'),
        models.Transaction.description == 'Transação Telegram',
    )
    if ws_ids:
        tx_stats = db.query(
            func.count(models.Transaction.id),
            func.min(models.Transaction.created_at),
            func.max(models.Transaction.created_at),
            func.coalesce(func.sum(case((is_bot_tx, 1), else_=0)), 0),
            func.max(case((is_bot_tx, models.Transaction.created_at), else_=None)),
        ).filter(models.Transaction.workspace_id.in_(ws_ids)).first()
        total_tx, first_tx, last_tx, bot_tx, last_bot_tx = tx_stats
        categories_count = db.query(func.count(models.Category.id)).filter(models.Category.workspace_id.in_(ws_ids)).scalar() or 0
        goals_count = db.query(func.count(models.SavingsGoal.id)).filter(models.SavingsGoal.workspace_id.in_(ws_ids)).scalar() or 0
    else:
        total_tx = first_tx = last_tx = last_bot_tx = None
        bot_tx = 0
        categories_count = goals_count = 0

    copilot_count = (
        db.query(func.count(models.CopilotMessage.id))
        .join(models.CopilotConversation, models.CopilotMessage.conversation_id == models.CopilotConversation.id)
        .filter(models.CopilotConversation.user_id == user_id, models.CopilotMessage.role == 'user')
        .scalar() or 0
    )

    # Telegram
    telegram_pending = 0
    if user.phone_number:
        telegram_pending = db.query(func.count(models.TelegramPendingTransaction.id)).filter(
            models.TelegramPendingTransaction.chat_id == str(user.phone_number)
        ).scalar() or 0

    # Afiliado
    referrals_count = db.query(func.count(models.AffiliateReferral.id)).filter(
        models.AffiliateReferral.referrer_id == user_id
    ).scalar() or 0
    referrals_converted = db.query(func.count(models.AffiliateReferral.id)).filter(
        models.AffiliateReferral.referrer_id == user_id,
        models.AffiliateReferral.has_subscribed == True,
    ).scalar() or 0
    commissions_total = db.query(func.coalesce(func.sum(models.AffiliateCommission.commission_amount_cents), 0)).filter(
        models.AffiliateCommission.affiliate_id == user_id
    ).scalar() or 0
    commissions_pending = db.query(func.coalesce(func.sum(models.AffiliateCommission.commission_amount_cents), 0)).filter(
        models.AffiliateCommission.affiliate_id == user_id,
        models.AffiliateCommission.is_paid == False,
    ).scalar() or 0
    referred_by_email = None
    if user.referrer_id:
        referrer = db.query(models.User.email).filter(models.User.id == user.referrer_id).first()
        referred_by_email = referrer[0] if referrer else None

    # Stripe em tempo real (1 user — aceitável; tudo com fallback silencioso)
    customer_id = (user.stripe_customer_id or '').strip()
    is_simulated = customer_id.startswith('sim_') or customer_id.startswith('test_')
    stripe_info = None
    has_payment_method = False
    if customer_id and not is_simulated and settings.STRIPE_API_KEY:
        stripe_info = schemas.AdminUserStripeInfo()
        try:
            if user.stripe_subscription_id:
                sub = stripe.Subscription.retrieve(user.stripe_subscription_id)
                stripe_info.status = sub.get('status')
                stripe_info.current_period_end = sub.get('current_period_end')
                stripe_info.cancel_at_period_end = bool(sub.get('cancel_at_period_end'))
                stripe_info.canceled_at = sub.get('canceled_at')
                meta = sub.get('metadata') or {}
                price_id = (meta.get('original_price_id') or '').strip() or None
                if not price_id:
                    items = sub.get('items', {})
                    items_data = items.get('data', []) if isinstance(items, dict) else []
                    if items_data:
                        price_id = items_data[0].get('price', {}).get('id')
                stripe_info.price_id = price_id
        except Exception as e:
            logger.warning(f'Admin detail: subscrição Stripe falhou para {user.email}: {e}')
        try:
            pms = stripe.PaymentMethod.list(customer=customer_id, type='card', limit=1)
            if pms.data:
                card = pms.data[0].get('card') or {}
                stripe_info.card_brand = card.get('brand')
                stripe_info.card_last4 = card.get('last4')
                has_payment_method = True
        except Exception as e:
            logger.warning(f'Admin detail: payment methods falhou para {user.email}: {e}')
        try:
            invs = stripe.Invoice.list(customer=customer_id, limit=5)
            stripe_info.invoices = [
                {
                    'amount_paid_cents': inv.get('amount_paid') or 0,
                    'amount_due_cents': inv.get('amount_due') or 0,
                    'status': inv.get('status'),
                    'created': inv.get('created'),
                    'invoice_pdf': inv.get('invoice_pdf'),
                }
                for inv in invs.data
            ]
        except Exception as e:
            logger.warning(f'Admin detail: invoices falharam para {user.email}: {e}')

    return schemas.AdminUserFullDetail(
        id=user.id,
        email=user.email,
        full_name=user.full_name,
        gender=user.gender,
        language=user.language,
        currency=user.currency,
        created_at=user.created_at,
        updated_at=user.updated_at,
        is_active=bool(user.is_active),
        is_admin=bool(user.is_admin),
        is_email_verified=bool(user.is_email_verified),
        is_onboarded=bool(user.is_onboarded),
        marketing_opt_in=bool(user.marketing_opt_in),
        terms_accepted=bool(user.terms_accepted),
        has_google_login=bool(user.google_id),
        has_password=bool(user.password_hash),
        login_count=int(user.login_count or 0),
        last_login=user.last_login,
        subscription_status=user.subscription_status or 'none',
        pro_granted_until=user.pro_granted_until,
        had_trial=bool(user.had_trial),
        trial_ends_at=user.trial_ends_at,
        had_refund=bool(user.had_refund),
        has_stripe_customer=bool(customer_id),
        has_payment_method=has_payment_method,
        last_payment_failure_code=user.last_payment_failure_code,
        last_payment_failure_message=user.last_payment_failure_message,
        last_payment_failed_at=user.last_payment_failed_at,
        stripe=stripe_info,
        telegram_linked=bool(user.phone_number),
        telegram_auto_confirm=bool(user.telegram_auto_confirm),
        bot_transactions_count=int(bot_tx or 0),
        last_bot_tx_at=last_bot_tx,
        telegram_pending_count=int(telegram_pending),
        total_transactions=int(total_tx or 0),
        first_tx_at=first_tx,
        last_tx_at=last_tx,
        workspaces_count=len(ws_ids),
        categories_count=int(categories_count),
        goals_count=int(goals_count),
        copilot_messages_count=int(copilot_count),
        is_affiliate=bool(user.is_affiliate),
        affiliate_code=user.affiliate_code,
        referrals_count=int(referrals_count),
        referrals_converted=int(referrals_converted),
        commissions_total_cents=int(commissions_total),
        commissions_pending_cents=int(commissions_pending),
        stripe_connect_status=user.stripe_connect_account_status if user.stripe_connect_account_id else None,
        referred_by_email=referred_by_email,
    )

@router.post('/users/{user_id}/toggle-admin')
async def toggle_admin_status(user_id: UUID, request: Request, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail='Não podes alterar o teu próprio estado de admin.')
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')
    
    user.is_admin = not user.is_admin
    db.commit()
    await log_action(
        db,
        action='admin_toggle_admin',
        user_id=admin.id,
        details=f'Admin status alterado para {user.email}: {user.is_admin}',
        request=request,
    )
    return {'message': f"Admin status for {user.email} updated to {user.is_admin}"}


@router.post('/users/{user_id}/grant-pro')
async def grant_pro_to_user(
    user_id: UUID,
    body: schemas.GrantProRequest,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(check_admin)
):
    """Concede Pro a um utilizador até uma data (ou por N meses)."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')
    until = body.until
    if until is None and body.months is not None:
        until = datetime.now(timezone.utc) + timedelta(days=body.months * 30)
    if until is None:
        raise HTTPException(status_code=400, detail='Indica "until" (data ISO) ou "months" (número).')
    if until <= datetime.now(timezone.utc):
        raise HTTPException(status_code=400, detail='A data deve ser no futuro.')
    user.pro_granted_until = until
    db.commit()
    await log_action(db, action='admin_grant_pro', user_id=admin_user.id, details=f'Pro concedido a {user.email} até {until.isoformat()}', request=request)
    return {'success': True, 'pro_granted_until': until.isoformat(), 'message': f'Pro concedido até {until.strftime("%Y-%m-%d")}'}


@router.post('/users/{user_id}/revoke-pro')
async def revoke_granted_pro(
    user_id: UUID,
    request: Request,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(check_admin)
):
    """Remove o Pro concedido manualmente (pro_granted_until). Não afeta subscrição Stripe."""
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')
    user.pro_granted_until = None
    db.commit()
    await log_action(db, action='admin_revoke_pro', user_id=admin_user.id, details=f'Pro concedido revogado para {user.email}', request=request)
    return {'success': True, 'message': 'Pro concedido revogado.'}

@router.put('/users/{user_id}', response_model=schemas.AdminUserResponse)
async def update_user_admin(request: Request, user_id: UUID, user_update: schemas.AdminUserUpdate, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')
    
    update_data = user_update.dict(exclude_unset=True)
    # Prevent admin from changing their own admin status via this endpoint
    if user_id == admin.id and 'is_admin' in update_data:
        raise HTTPException(status_code=400, detail='Não podes alterar o teu próprio estado de admin.')
    # Block sensitive fields that should not be set via generic update
    blocked_fields = {'password_hash', 'id', 'created_at'}
    for field, value in update_data.items():
        if field in blocked_fields:
            continue
        # If changing email, check uniqueness
        if field == 'email' and value:
            value = value.strip().lower()
            existing = db.query(models.User).filter(models.User.email == value, models.User.id != user_id).first()
            if existing:
                raise HTTPException(status_code=409, detail='Email já está em uso.')
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    await log_action(db, action='admin_user_update', user_id=admin.id, details=f'Updated user: {user.email}', request=request)
    return user

@router.delete('/users/{user_id}')
async def delete_user_admin(request: Request, user_id: UUID, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail='Não podes eliminar o teu próprio utilizador.')
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')
    
    email = user.email
    db.delete(user)
    db.commit()
    
    await log_action(db, action='admin_user_delete', user_id=admin.id, details=f'Deleted user: {email}', request=request)
    return {'message': 'Utilizador eliminado com sucesso'}

@router.get('/settings')
async def get_system_settings(db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    settings_list = db.query(models.SystemSetting).all()
    return {s.key: s.value for s in settings_list}

# Chaves permitidas para system settings (whitelist)
ALLOWED_SYSTEM_SETTING_KEYS = {
    'affiliate_commission_percentage_plus',
    'affiliate_commission_percentage_pro',
    'maintenance_mode',
    'site_name',
    'site_url',
    'support_email',
    'max_free_transactions',
    'max_free_categories',
    'max_free_recurring',
}


@router.post('/settings')
async def update_system_setting(data: dict, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    invalid_keys = [k for k in data.keys() if k not in ALLOWED_SYSTEM_SETTING_KEYS]
    if invalid_keys:
        raise HTTPException(
            status_code=400,
            detail=f'Chaves não permitidas: {", ".join(invalid_keys)}. Chaves válidas: {", ".join(sorted(ALLOWED_SYSTEM_SETTING_KEYS))}'
        )
    for key, value in data.items():
        str_value = str(value).strip()
        if len(str_value) > 500:
            raise HTTPException(status_code=400, detail=f'Valor demasiado longo para chave "{key}" (máx 500 caracteres).')
        setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
        if setting:
            setting.value = str_value
        else:
            setting = models.SystemSetting(key=key, value=str_value)
            db.add(setting)
    db.commit()
    # Invalidar o cache em memória de /api/settings/public (reflete a mudança de imediato).
    try:
        from .. import main as _main
        _main._public_settings_cache["value"] = None
    except Exception:
        pass
    return {"message": "Definições atualizadas"}

def _get_commission_setting(db: Session, key: str, default: float, description: str) -> models.SystemSetting:
    """Obtém ou cria SystemSetting de comissão."""
    s = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
    if s:
        return s
    s = models.SystemSetting(key=key, value=str(default), description=description)
    db.add(s)
    return s


@router.get('/affiliates/commission-percentage')
async def get_commission_percentage(
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """Retorna as percentagens de comissão por plano: Plus (20%) e Pro (25%). Editável pelo admin."""
    plus_s = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == 'affiliate_commission_percentage_plus'
    ).first()
    pro_s = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == 'affiliate_commission_percentage_pro'
    ).first()
    plus = float(plus_s.value) if plus_s and plus_s.value else 20.0
    pro = float(pro_s.value) if pro_s and pro_s.value else 25.0
    return {
        'plus': plus,
        'pro': pro,
        'description': 'Plus = 20%, Pro = 25%. Afiliados ganham esta comissão em cada cobrança (mensal/anual) enquanto o referido continuar subscrito.'
    }


@router.post('/affiliates/commission-percentage')
async def update_commission_percentage(
    request: Request,
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """Atualiza as percentagens de comissão por plano (Plus e/ou Pro). Body: { "plus": 20, "pro": 25 }."""
    body = await request.json() if request else {}
    plus_val = body.get('plus')
    pro_val = body.get('pro')
    if plus_val is None and pro_val is None:
        raise HTTPException(status_code=400, detail='Envia "plus" e/ou "pro" no body (0-100).')
    details_parts = []
    if plus_val is not None:
        if not isinstance(plus_val, (int, float)) or not (0 <= plus_val <= 100):
            raise HTTPException(status_code=400, detail='"plus" deve ser um número entre 0 e 100.')
        plus_s = _get_commission_setting(
            db, 'affiliate_commission_percentage_plus', 20.0,
            'Comissão afiliados plano Plus (ex: 20 = 20%)'
        )
        plus_s.value = str(float(plus_val))
        details_parts.append(f'Plus={plus_val}%')
    if pro_val is not None:
        if not isinstance(pro_val, (int, float)) or not (0 <= pro_val <= 100):
            raise HTTPException(status_code=400, detail='"pro" deve ser um número entre 0 e 100.')
        pro_s = _get_commission_setting(
            db, 'affiliate_commission_percentage_pro', 25.0,
            'Comissão afiliados plano Pro (ex: 25 = 25%)'
        )
        pro_s.value = str(float(pro_val))
        details_parts.append(f'Pro={pro_val}%')
    db.commit()
    await log_action(
        db,
        action='admin_update_commission_percentage',
        user_id=admin.id,
        details='Comissões atualizadas: ' + ', '.join(details_parts),
        request=None
    )
    plus_s = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == 'affiliate_commission_percentage_plus'
    ).first()
    pro_s = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == 'affiliate_commission_percentage_pro'
    ).first()
    plus = float(plus_s.value) if plus_s and plus_s.value else 20.0
    pro = float(pro_s.value) if pro_s and pro_s.value else 25.0
    return {"message": "Comissões atualizadas.", "plus": plus, "pro": pro}

def _render_broadcast_html(subject: str, message: str, footer: str) -> str:
    import html as html_module
    safe_subject = html_module.escape(subject)
    safe_message = html_module.escape(message).replace('\n', '<br>')
    safe_footer = html_module.escape(footer)
    return f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; background-color: #020617; color: #94a3b8; padding: 40px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 24px; padding: 40px; border: 1px solid #1e293b;">
            <h2 style="color: #ffffff; margin-top: 0;">{safe_subject}</h2>
            <p style="line-height: 1.6; font-size: 16px;">{safe_message}</p>
            <hr style="border: 0; border-top: 1px solid #1e293b; margin: 30px 0;">
            <p style="font-size: 12px; color: #475569;">{safe_footer}</p>
        </div>
    </body>
    </html>
    """


async def _run_marketing_broadcast(subject: str, message: str, admin_id, recipients: list):
    """
    Envia o broadcast em background (não bloqueia o pedido). `recipients` é uma lista de
    tuplos (email, lang) já deduplicada. Conta sucessos/falhas e regista o resultado no AuditLog.
    """
    fm = FastMail(conf)
    sent = 0
    failed = 0
    failed_emails: list = []
    for email, lang in recipients:
        try:
            user_lang = lang if lang in ('pt', 'en') else 'pt'
            t = get_email_translation(user_lang)
            footer = t.get('marketing_footer', 'Recebeu este email porque aceitou as comunicações de marketing do Finly.')
            html = _render_broadcast_html(subject, message, footer)
            await fm.send_message(MessageSchema(
                subject=subject, recipients=[email], body=html, subtype=MessageType.html
            ))
            sent += 1
        except Exception as e:
            failed += 1
            if len(failed_emails) < 50:
                failed_emails.append(email)
            logger.error(f"ERROR: Falha ao enviar broadcast para {email}: {e}")

    # Registar o resultado no AuditLog (sessão própria; corre fora do request).
    _db = SessionLocal()
    try:
        log_details = json.dumps({
            "subject": subject,
            "message": message,
            "total": len(recipients),
            "sent": sent,
            "failed": failed,
            "failed_sample": failed_emails,
        }, ensure_ascii=False)
        _db.add(models.AuditLog(user_id=admin_id, action='marketing_broadcast', details=log_details))
        _db.commit()
    except Exception as e:
        _db.rollback()
        logger.warning(f"Falha ao registar resultado do broadcast: {e}")
    finally:
        _db.close()
    logger.info(f"Broadcast concluído: {sent} enviados, {failed} falhados (de {len(recipients)}).")


@router.post('/marketing/broadcast')
async def send_marketing_broadcast(
    request: Request,
    broadcast: schemas.BroadcastRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    # Destinatários (opt-in) deduplicados por email.
    rows = db.query(models.User.email, models.User.language).filter(
        models.User.marketing_opt_in == True,
        models.User.email.isnot(None),
    ).all()
    seen = set()
    recipients = []
    for email, lang in rows:
        key = (email or '').strip().lower()
        if not key or key in seen:
            continue
        seen.add(key)
        recipients.append((email, (lang or 'pt')))

    if not recipients:
        return {"message": "Nenhum utilizador com marketing opt-in encontrado.", "count": 0}

    # Envio em background -> resposta imediata (evita timeout com muitos destinatários).
    background_tasks.add_task(_run_marketing_broadcast, broadcast.subject, broadcast.message, admin.id, recipients)

    return {
        "message": "Broadcast iniciado. O envio decorre em segundo plano; o resultado fica no log de auditoria.",
        "total_users": len(recipients),
        "queued": True,
    }

# ==================== ROTAS DE AFILIADOS ====================

def generate_affiliate_code() -> str:
    """Gera um código único de afiliado"""
    while True:
        code = secrets.token_urlsafe(6).upper()[:8].replace('-', '').replace('_', '')
        if any(c.isalpha() for c in code) and any(c.isdigit() for c in code):
            return code

@router.get('/affiliates/users')
async def get_all_users_for_promotion(
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin),
    search: Optional[str] = Query(None, description="Pesquisar por email ou nome"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    """Utilizadores que ainda não são afiliados (para promover). Paginado."""
    query = db.query(models.User).filter(models.User.is_affiliate == False)

    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (models.User.email.ilike(search_term)) |
            (models.User.full_name.ilike(search_term))
        )

    total = query.count()
    users = query.order_by(models.User.created_at.desc()).offset(offset).limit(limit).all()

    return {
        'total': total,
        'limit': limit,
        'offset': offset,
        'users': [{
            'user_id': str(u.id),
            'email': u.email,
            'full_name': u.full_name,
            'created_at': u.created_at.isoformat() if u.created_at else None
        } for u in users],
    }

@router.get('/affiliates', response_model=List[schemas.AdminAffiliateResponse])
async def get_all_affiliates(
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """Lista todos os afiliados"""
    affiliates = db.query(models.User).filter(models.User.is_affiliate == True).all()
    aff_ids = [a.id for a in affiliates]

    # Eliminado o N+1 (eram 3 queries por afiliado): agregamos referrals/conversões e
    # ganhos numa só query cada, agrupadas por afiliado, e mapeamos em memória.
    referrals_map: Dict[UUID, tuple] = {}
    earnings_map: Dict[UUID, int] = {}
    if aff_ids:
        for referrer_id, total_ref, total_conv in db.query(
            models.AffiliateReferral.referrer_id,
            func.count(models.AffiliateReferral.id),
            func.coalesce(func.sum(case((models.AffiliateReferral.has_subscribed == True, 1), else_=0)), 0),
        ).filter(
            models.AffiliateReferral.referrer_id.in_(aff_ids)
        ).group_by(models.AffiliateReferral.referrer_id).all():
            referrals_map[referrer_id] = (int(total_ref or 0), int(total_conv or 0))

        for affiliate_id, total_earn in db.query(
            models.AffiliateCommission.affiliate_id,
            func.coalesce(func.sum(models.AffiliateCommission.commission_amount_cents), 0),
        ).filter(
            models.AffiliateCommission.affiliate_id.in_(aff_ids)
        ).group_by(models.AffiliateCommission.affiliate_id).all():
            earnings_map[affiliate_id] = int(total_earn or 0)

    result = []
    for aff in affiliates:
        total_referrals, total_conversions = referrals_map.get(aff.id, (0, 0))
        result.append(schemas.AdminAffiliateResponse(
            user_id=aff.id,
            email=aff.email,
            full_name=aff.full_name,
            affiliate_code=aff.affiliate_code,
            is_affiliate=aff.is_affiliate,
            total_referrals=total_referrals,
            total_conversions=total_conversions,
            total_earnings_cents=earnings_map.get(aff.id, 0),
            created_at=aff.created_at
        ))

    return result

@router.get('/affiliates/top', response_model=List[schemas.AdminAffiliateResponse])
async def get_top_affiliates(
    limit: int = 3,
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """Retorna top N afiliados por conversões"""
    affiliates = db.query(
        models.User,
        func.count(models.AffiliateReferral.id).label('conversions')
    ).join(
        models.AffiliateReferral,
        models.User.id == models.AffiliateReferral.referrer_id
    ).filter(
        and_(
            models.User.is_affiliate == True,
            models.AffiliateReferral.has_subscribed == True
        )
    ).group_by(models.User.id).order_by(desc('conversions')).limit(limit).all()

    # Agregar referrals e ganhos em 2 queries (em vez de 2 por afiliado).
    top_ids = [aff.id for aff, _ in affiliates]
    referrals_map: Dict[UUID, int] = {}
    earnings_map: Dict[UUID, int] = {}
    if top_ids:
        for rid, cnt in db.query(
            models.AffiliateReferral.referrer_id, func.count(models.AffiliateReferral.id)
        ).filter(models.AffiliateReferral.referrer_id.in_(top_ids)).group_by(models.AffiliateReferral.referrer_id).all():
            referrals_map[rid] = int(cnt or 0)
        for aid, total in db.query(
            models.AffiliateCommission.affiliate_id, func.coalesce(func.sum(models.AffiliateCommission.commission_amount_cents), 0)
        ).filter(models.AffiliateCommission.affiliate_id.in_(top_ids)).group_by(models.AffiliateCommission.affiliate_id).all():
            earnings_map[aid] = int(total or 0)

    result = []
    for aff, conversions in affiliates:
        result.append(schemas.AdminAffiliateResponse(
            user_id=aff.id,
            email=aff.email,
            full_name=aff.full_name,
            affiliate_code=aff.affiliate_code,
            is_affiliate=aff.is_affiliate,
            total_referrals=referrals_map.get(aff.id, 0),
            total_conversions=conversions,
            total_earnings_cents=earnings_map.get(aff.id, 0),
            created_at=aff.created_at
        ))

    return result

@router.get('/affiliates/stats')
async def get_affiliates_stats(
    affiliate_id: Optional[str] = Query(default=None, description="ID do afiliado para filtrar (opcional)"),
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """Estatísticas gerais de afiliados (pode filtrar por afiliado)"""
    try:
        # Converter string para UUID se fornecido
        affiliate_uuid = None
        if affiliate_id:
            try:
                affiliate_uuid = UUID(affiliate_id)
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="ID de afiliado inválido")
        
        query = db.query(models.AffiliateReferral)
        if affiliate_uuid:
            query = query.filter(models.AffiliateReferral.referrer_id == affiliate_uuid)
        
        total_referrals = query.count()
        total_conversions = query.filter(models.AffiliateReferral.has_subscribed == True).count()
        
        # Total de afiliados
        total_affiliates = db.query(func.count(models.User.id)).filter(
            models.User.is_affiliate == True
        ).scalar() or 0
        
        # Total de earnings (todas as comissões, pagas ou não)
        earnings_query = db.query(func.sum(models.AffiliateCommission.commission_amount_cents))
        if affiliate_uuid:
            earnings_query = earnings_query.filter(models.AffiliateCommission.affiliate_id == affiliate_uuid)
        total_earnings = earnings_query.scalar() or 0
        
        # Total de comissões PAGAS (is_paid = True)
        paid_earnings_query = db.query(func.sum(models.AffiliateCommission.commission_amount_cents)).filter(
            models.AffiliateCommission.is_paid == True
        )
        if affiliate_uuid:
            paid_earnings_query = paid_earnings_query.filter(models.AffiliateCommission.affiliate_id == affiliate_uuid)
        total_paid_earnings = paid_earnings_query.scalar() or 0
        
        # Total de receita gerada pelos afiliados (total_revenue_cents das comissões)
        revenue_query = db.query(func.sum(models.AffiliateCommission.total_revenue_cents))
        if affiliate_uuid:
            revenue_query = revenue_query.filter(models.AffiliateCommission.affiliate_id == affiliate_uuid)
        total_revenue_cents = revenue_query.scalar() or 0
        
        # Se não houver comissões calculadas, calcular a partir das referrals
        if total_revenue_cents == 0 and total_conversions > 0:
            logger.info('Nenhuma comissão calculada encontrada, calculando a partir das referrals...')
            # Fallback: média Plus/Pro (estimativa; o Stripe usa 20%/25% por plano)
            plus_s = db.query(models.SystemSetting).filter(models.SystemSetting.key == 'affiliate_commission_percentage_plus').first()
            pro_s = db.query(models.SystemSetting).filter(models.SystemSetting.key == 'affiliate_commission_percentage_pro').first()
            plus_pct = float(plus_s.value) if plus_s and plus_s.value else 20.0
            pro_pct = float(pro_s.value) if pro_s and pro_s.value else 25.0
            commission_percentage = (plus_pct + pro_pct) / 2
            
            # Valor padrão por subscrição (9.99€ mensal)
            default_monthly_revenue = 999  # 9.99€ em cêntimos
            
            # Calcular receita total e comissões a partir das conversões
            total_revenue_cents = default_monthly_revenue * total_conversions
            total_earnings = int(total_revenue_cents * (commission_percentage / 100))
            # Se não há comissões calculadas, também não há comissões pagas
            total_paid_earnings = 0
        
        conversion_rate = (total_conversions / total_referrals * 100) if total_referrals > 0 else 0.0
        
        return {
            'total_affiliates': total_affiliates,
            'total_referrals': total_referrals,
            'total_conversions': total_conversions,
            'conversion_rate': round(conversion_rate, 2),
            'total_earnings_cents': int(total_earnings or 0),
            'total_paid_earnings_cents': int(total_paid_earnings or 0),
            'total_revenue_cents': int(total_revenue_cents or 0)
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Erro ao buscar stats de afiliados: {str(e)}', exc_info=True)
        raise HTTPException(status_code=500, detail='Erro ao buscar estatísticas de afiliados.')

@router.get('/affiliates/revenue-timeline')
async def get_affiliates_revenue_timeline(
    affiliate_id: Optional[str] = Query(default=None, description="ID do afiliado para filtrar (opcional)"),
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """Retorna timeline de faturamento por afiliado"""
    try:
        affiliate_uuid = None
        if affiliate_id:
            try:
                affiliate_uuid = UUID(affiliate_id)
            except (ValueError, TypeError):
                raise HTTPException(status_code=400, detail="ID de afiliado inválido")
        
        # Primeiro, tentar buscar das comissões calculadas
        query = db.query(
            models.AffiliateCommission.month,
            func.sum(models.AffiliateCommission.total_revenue_cents).label('revenue'),
            func.sum(models.AffiliateCommission.commission_amount_cents).label('commission'),
            func.count(models.AffiliateCommission.id).label('commissions_count')
        ).group_by(models.AffiliateCommission.month)
        
        if affiliate_uuid:
            query = query.filter(models.AffiliateCommission.affiliate_id == affiliate_uuid)
        
        results = query.order_by(models.AffiliateCommission.month.desc()).limit(12).all()
        
        timeline = []
        for row in results:
            timeline.append({
                'month': row.month.strftime('%Y-%m'),
                'month_label': row.month.strftime('%b %Y'),
                'revenue_cents': int(row.revenue or 0),
                'commission_cents': int(row.commission or 0),
                'commissions_count': row.commissions_count
            })
        
        # Se não houver comissões calculadas, buscar dados das referrals diretamente
        if not timeline:
            logger.info('Nenhuma comissão calculada encontrada, buscando dados das referrals...')
            referrals_query = db.query(
                func.date_trunc('month', models.AffiliateReferral.subscription_date).label('month'),
                func.count(models.AffiliateReferral.id).label('count')
            ).filter(
                models.AffiliateReferral.has_subscribed == True,
                models.AffiliateReferral.subscription_date.isnot(None)
            )
            
            if affiliate_uuid:
                referrals_query = referrals_query.filter(models.AffiliateReferral.referrer_id == affiliate_uuid)
            
            referrals_results = referrals_query.group_by(
                func.date_trunc('month', models.AffiliateReferral.subscription_date)
            ).order_by(
                func.date_trunc('month', models.AffiliateReferral.subscription_date).desc()
            ).limit(12).all()
            
            # Fallback: média Plus/Pro (estimativa; Stripe usa 20%/25% por plano)
            plus_s = db.query(models.SystemSetting).filter(models.SystemSetting.key == 'affiliate_commission_percentage_plus').first()
            pro_s = db.query(models.SystemSetting).filter(models.SystemSetting.key == 'affiliate_commission_percentage_pro').first()
            commission_percentage = ((float(plus_s.value) if plus_s and plus_s.value else 20.0) + (float(pro_s.value) if pro_s and pro_s.value else 25.0)) / 2
            
            # Valor padrão por subscrição (9.99€ mensal ou 89.90€ anual)
            default_monthly_revenue = 999  # 9.99€ em cêntimos
            
            for row in referrals_results:
                if row.month:
                    revenue = default_monthly_revenue * row.count
                    commission = int(revenue * (commission_percentage / 100))
                    timeline.append({
                        'month': row.month.strftime('%Y-%m'),
                        'month_label': row.month.strftime('%b %Y'),
                        'revenue_cents': revenue,
                        'commission_cents': commission,
                        'commissions_count': row.count
                    })
        
        return {'timeline': timeline}
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Erro ao buscar timeline de receita: {str(e)}', exc_info=True)
        raise HTTPException(status_code=500, detail='Erro ao buscar timeline de afiliados.')

@router.get('/affiliates/revenue-by-affiliate')
async def get_revenue_by_affiliate(
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """Retorna receita e comissões por afiliado"""
    try:
        # Primeiro, tentar buscar das comissões calculadas
        results = db.query(
            models.User.id,
            models.User.email,
            models.User.full_name,
            models.User.affiliate_code,
            func.sum(models.AffiliateCommission.total_revenue_cents).label('total_revenue'),
            func.sum(models.AffiliateCommission.commission_amount_cents).label('total_commission'),
            func.count(models.AffiliateCommission.id).label('months_active'),
            func.max(models.AffiliateCommission.month).label('last_month')
        ).join(
            models.AffiliateCommission, models.User.id == models.AffiliateCommission.affiliate_id
        ).filter(
            models.User.is_affiliate == True
        ).group_by(
            models.User.id, models.User.email, models.User.full_name, models.User.affiliate_code
        ).order_by(
            desc(func.sum(models.AffiliateCommission.total_revenue_cents))
        ).all()
        
        affiliates_data = []
        for row in results:
            affiliates_data.append({
                'user_id': str(row.id),
                'email': row.email,
                'full_name': row.full_name,
                'affiliate_code': row.affiliate_code,
                'total_revenue_cents': int(row.total_revenue or 0),
                'total_commission_cents': int(row.total_commission or 0),
                'months_active': row.months_active,
                'last_month': row.last_month.strftime('%Y-%m') if row.last_month else None
            })
        
        # Se não houver comissões calculadas, buscar dados das referrals diretamente
        if not affiliates_data:
            logger.info('Nenhuma comissão calculada encontrada, buscando dados das referrals...')
            # Estimativa: média Plus/Pro (Stripe usa 20%/25% por plano)
            plus_s = db.query(models.SystemSetting).filter(models.SystemSetting.key == 'affiliate_commission_percentage_plus').first()
            pro_s = db.query(models.SystemSetting).filter(models.SystemSetting.key == 'affiliate_commission_percentage_pro').first()
            commission_percentage = ((float(plus_s.value) if plus_s and plus_s.value else 20.0) + (float(pro_s.value) if pro_s and pro_s.value else 25.0)) / 2
            
            # Valor padrão por subscrição (9.99€ mensal)
            default_monthly_revenue = 999  # 9.99€ em cêntimos
            
            # Buscar afiliados com referrals que pagaram
            affiliates_with_referrals = db.query(
                models.User.id,
                models.User.email,
                models.User.full_name,
                models.User.affiliate_code,
                func.count(models.AffiliateReferral.id).filter(
                    models.AffiliateReferral.has_subscribed == True
                ).label('conversions'),
                func.max(models.AffiliateReferral.subscription_date).label('last_subscription')
            ).join(
                models.AffiliateReferral, models.User.id == models.AffiliateReferral.referrer_id
            ).filter(
                models.User.is_affiliate == True,
                models.AffiliateReferral.has_subscribed == True
            ).group_by(
                models.User.id, models.User.email, models.User.full_name, models.User.affiliate_code
            ).all()
            
            for row in affiliates_with_referrals:
                total_revenue = default_monthly_revenue * row.conversions
                total_commission = int(total_revenue * (commission_percentage / 100))
                affiliates_data.append({
                    'user_id': str(row.id),
                    'email': row.email,
                    'full_name': row.full_name,
                    'affiliate_code': row.affiliate_code,
                    'total_revenue_cents': total_revenue,
                    'total_commission_cents': total_commission,
                    'months_active': 1,  # Aproximação
                    'last_month': row.last_subscription.strftime('%Y-%m') if row.last_subscription else None
                })
            
            # Ordenar por receita total
            affiliates_data.sort(key=lambda x: x['total_revenue_cents'], reverse=True)
        
        return {'affiliates': affiliates_data}
    except Exception as e:
        logger.error(f'Erro ao buscar receita por afiliado: {str(e)}', exc_info=True)
        raise HTTPException(status_code=500, detail='Erro ao buscar receita por afiliado.')

@router.get('/affiliates/{user_id}', response_model=schemas.AdminAffiliateDetail)
async def get_affiliate_detail(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """Detalhes completos de um afiliado"""
    affiliate = db.query(models.User).filter(models.User.id == user_id).first()
    if not affiliate:
        raise HTTPException(status_code=404, detail='Afiliado não encontrado')
    
    if not affiliate.is_affiliate:
        raise HTTPException(status_code=400, detail='Este utilizador não é afiliado')
    
    # Estatísticas
    total_referrals = db.query(func.count(models.AffiliateReferral.id)).filter(
        models.AffiliateReferral.referrer_id == affiliate.id
    ).scalar() or 0
    
    total_conversions = db.query(func.count(models.AffiliateReferral.id)).filter(
        and_(
            models.AffiliateReferral.referrer_id == affiliate.id,
            models.AffiliateReferral.has_subscribed == True
        )
    ).scalar() or 0
    
    total_earnings = db.query(func.sum(models.AffiliateCommission.commission_amount_cents)).filter(
        models.AffiliateCommission.affiliate_id == affiliate.id
    ).scalar() or 0
    
    # Referências com informações de pagamento
    referrals = db.query(models.AffiliateReferral).filter(
        models.AffiliateReferral.referrer_id == affiliate.id
    ).order_by(models.AffiliateReferral.created_at.desc()).all()
    
    referrals_data = []
    for ref in referrals:
        referred_user = db.query(models.User).filter(models.User.id == ref.referred_user_id).first()
        
        # Buscar informações de pagamento do Stripe se o usuário pagou
        payment_info = None
        if ref.has_subscribed and referred_user:
            try:
                # Tentar buscar pela subscription_id primeiro
                if referred_user.stripe_subscription_id:
                    subscription = stripe.Subscription.retrieve(referred_user.stripe_subscription_id)
                # Se não tiver subscription_id, tentar buscar pelo customer_id
                elif referred_user.stripe_customer_id:
                    subscriptions = stripe.Subscription.list(
                        customer=referred_user.stripe_customer_id,
                        status='all',
                        limit=1
                    )
                    subscription = subscriptions.data[0] if subscriptions.data else None
                else:
                    subscription = None
                
                if subscription:
                    # Buscar última invoice paga
                    invoices = stripe.Invoice.list(
                        subscription=subscription.id,
                        status='paid',
                        limit=1
                    )
                    if invoices.data:
                        invoice = invoices.data[0]
                        plan_info = subscription.items.data[0].price if subscription.items.data else None
                        payment_info = {
                            'amount_paid_cents': invoice.amount_paid,
                            'currency': invoice.currency,
                            'paid_at': datetime.fromtimestamp(invoice.created).isoformat() if invoice.created else None,
                            'subscription_status': subscription.status,
                            'plan_name': plan_info.nickname if plan_info and plan_info.nickname else (plan_info.product if plan_info else None),
                            'plan_interval': plan_info.recurring.interval if plan_info and plan_info.recurring else None
                        }
                    else:
                        # Se não houver invoice paga, usar informações da subscription
                        plan_info = subscription.items.data[0].price if subscription.items.data else None
                        payment_info = {
                            'amount_paid_cents': plan_info.unit_amount if plan_info else 0,
                            'currency': plan_info.currency if plan_info else 'eur',
                            'paid_at': ref.subscription_date.isoformat() if ref.subscription_date else None,
                            'subscription_status': subscription.status,
                            'plan_name': plan_info.nickname if plan_info and plan_info.nickname else (plan_info.product if plan_info else None),
                            'plan_interval': plan_info.recurring.interval if plan_info and plan_info.recurring else None
                        }
            except Exception as e:
                logger.warning(f'Erro ao buscar informações do Stripe para {referred_user.email if referred_user else "N/A"}: {str(e)}')
                # Se houver erro mas o usuário pagou, criar payment_info básico
                if ref.has_subscribed and ref.subscription_date:
                    payment_info = {
                        'amount_paid_cents': 999,  # Valor padrão (9.99€)
                        'currency': 'eur',
                        'paid_at': ref.subscription_date.isoformat(),
                        'subscription_status': referred_user.subscription_status if referred_user else 'active',
                        'plan_name': None,
                        'plan_interval': None
                    }
        
        referral_dict = {
            'id': str(ref.id),
            'referred_user_email': referred_user.email if referred_user else 'N/A',
            'referred_user_full_name': referred_user.full_name if referred_user else None,
            'has_subscribed': ref.has_subscribed,
            'subscription_date': ref.subscription_date.isoformat() if ref.subscription_date else None,
            'subscription_canceled_at': getattr(ref, 'subscription_canceled_at', None).isoformat() if getattr(ref, 'subscription_canceled_at', None) else None,
            'created_at': ref.created_at.isoformat() if ref.created_at else None,
            'payment_info': payment_info
        }
        referrals_data.append(referral_dict)
    
    # Comissões
    commissions = db.query(models.AffiliateCommission).filter(
        models.AffiliateCommission.affiliate_id == affiliate.id
    ).order_by(models.AffiliateCommission.month.desc()).all()
    
    commissions_data = [schemas.AffiliateCommissionResponse.from_orm(c) for c in commissions]
    
    base = schemas.AdminAffiliateResponse(
        user_id=affiliate.id,
        email=affiliate.email,
        full_name=affiliate.full_name,
        affiliate_code=affiliate.affiliate_code,
        is_affiliate=affiliate.is_affiliate,
        total_referrals=total_referrals,
        total_conversions=total_conversions,
        total_earnings_cents=int(total_earnings),
        created_at=affiliate.created_at
    )
    
    # Retornar como dict para incluir payment_info nas referrals
    return {
        **base.dict(),
        'referrals': referrals_data,
        'commissions': [schemas.AffiliateCommissionResponse.from_orm(c).dict() for c in commissions]
    }


def get_affiliate_first_invoices_pending_list(db: Session, limit: int = 80) -> list:
    """
    Lista 1ª invoices (billing_reason=subscription_create) com referrer Connect onde
    não existe linha em affiliate_invoice_manual_transfers e o charge não tem transfer.
    Usado pelo endpoint admin e pelo job diário.
    """
    if not settings.STRIPE_API_KEY:
        return []
    pending = []
    for user in db.query(models.User).filter(
        models.User.stripe_subscription_id.isnot(None),
        models.User.referrer_id.isnot(None),
    ).limit(limit).all():
        referrer = db.query(models.User).filter(models.User.id == user.referrer_id).first()
        if not referrer or not referrer.stripe_connect_account_id:
            continue
        try:
            invoices = stripe.Invoice.list(
                subscription=user.stripe_subscription_id,
                status='paid',
                limit=20
            )
            first_invoice = None
            for inv in invoices.data:
                br = getattr(inv, 'billing_reason', None) or (inv.get('billing_reason') if isinstance(inv, dict) else None)
                if br == 'subscription_create':
                    first_invoice = inv
                    break
            if not first_invoice:
                continue
            invoice_id = first_invoice.id if hasattr(first_invoice, 'id') else first_invoice.get('id')
            existing = db.query(models.AffiliateInvoiceManualTransfer).filter(
                models.AffiliateInvoiceManualTransfer.invoice_id == invoice_id
            ).first()
            if existing:
                continue
            charge_id = first_invoice.charge if hasattr(first_invoice, 'charge') else first_invoice.get('charge')
            if not charge_id:
                continue
            charge = stripe.Charge.retrieve(charge_id)
            if charge.get('transfer'):
                continue
            amount_paid = first_invoice.amount_paid if hasattr(first_invoice, 'amount_paid') else first_invoice.get('amount_paid', 0)
            currency = first_invoice.currency if hasattr(first_invoice, 'currency') else first_invoice.get('currency', 'eur')
            created_ts = first_invoice.created if hasattr(first_invoice, 'created') else first_invoice.get('created')
            pending.append({
                'user_email': user.email,
                'referred_user_id': str(user.id),
                'subscription_id': user.stripe_subscription_id,
                'invoice_id': invoice_id,
                'amount_paid_cents': amount_paid,
                'currency': currency,
                'referrer_email': referrer.email,
                'referrer_id': str(referrer.id),
                'referrer_connect_account_id': referrer.stripe_connect_account_id,
                'invoice_created_at': datetime.fromtimestamp(created_ts).isoformat() if created_ts else None,
                'needs_manual_transfer': True,
            })
        except stripe.error.StripeError as e:
            logger.warning(f'Stripe error ao verificar 1ª invoice para user {user.email}: {e}')
        except Exception as e:
            logger.warning(f'Erro ao verificar 1ª invoice para user {user.email}: {e}', exc_info=True)
    return pending


@router.get('/affiliates/first-invoices-pending')
async def get_affiliate_first_invoices_pending(
    limit: int = Query(80, ge=1, le=200),
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """
    Lista 1ª invoices (billing_reason=subscription_create) com referrer Connect onde:
    - não existe linha em affiliate_invoice_manual_transfers
    - e o charge não tem transfer (split não foi aplicado).
    Para tratar manualmente os que falharam (pagamento duplo evitado pelo resto do fluxo).
    """
    if not settings.STRIPE_API_KEY:
        return {'pending': [], 'message': 'STRIPE_API_KEY não configurado'}
    pending = get_affiliate_first_invoices_pending_list(db, limit=limit)
    return {'pending': pending, 'count': len(pending)}


@router.post('/affiliates/promote', response_model=schemas.AdminAffiliateResponse)
async def promote_to_affiliate(
    request: Request,
    promote_data: schemas.PromoteToAffiliateRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """Promove um utilizador a afiliado"""
    user = db.query(models.User).filter(models.User.id == promote_data.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')
    
    if user.is_affiliate:
        raise HTTPException(status_code=400, detail='Utilizador já é afiliado')
    
    # Gerar código único
    code = generate_affiliate_code()
    while db.query(models.User).filter(models.User.affiliate_code == code).first():
        code = generate_affiliate_code()
    
    user.is_affiliate = True
    user.affiliate_code = code
    db.commit()
    db.refresh(user)
    
    await log_action(
        db,
        action='admin_promote_affiliate',
        user_id=admin.id,
        details=f'Promovido {user.email} a afiliado com código {code}',
        request=request
    )
    
    return schemas.AdminAffiliateResponse(
        user_id=user.id,
        email=user.email,
        full_name=user.full_name,
        affiliate_code=user.affiliate_code,
        is_affiliate=user.is_affiliate,
        total_referrals=0,
        total_conversions=0,
        total_earnings_cents=0,
        created_at=user.created_at
    )

@router.post('/affiliates/calculate-monthly')
async def calculate_monthly_commissions(
    request: Request,
    month: Optional[str] = None,  # Formato: YYYY-MM
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """Calcula comissões mensais (executar no fim do mês)"""
    from datetime import datetime
    from decimal import Decimal
    
    # Se não especificado, usar mês anterior
    if not month:
        last_month = datetime.now(timezone.utc).replace(day=1) - timedelta(days=1)
        month = last_month.strftime('%Y-%m')
    
    month_date = datetime.strptime(month, '%Y-%m').date().replace(day=1)
    
    # Buscar todos os afiliados
    affiliates = db.query(models.User).filter(models.User.is_affiliate == True).all()
    
    calculated_count = 0
    
    for affiliate in affiliates:
        # Verificar se já foi calculado
        existing = db.query(models.AffiliateCommission).filter(
            and_(
                models.AffiliateCommission.affiliate_id == affiliate.id,
                models.AffiliateCommission.month == month_date
            )
        ).first()
        
        if existing:
            continue  # Já foi calculado
        
        # Buscar referências que subscreveram neste mês
        referrals = db.query(models.AffiliateReferral).filter(
            and_(
                models.AffiliateReferral.referrer_id == affiliate.id,
                models.AffiliateReferral.has_subscribed == True,
                func.date_trunc('month', models.AffiliateReferral.subscription_date) == month_date
            )
        ).all()
        
        if not referrals:
            continue

        # Receita e comissão por referral: usar percentagem por plano (Plus 20%, Pro 25%) como no Stripe
        total_revenue = 0
        total_commission = 0
        DEFAULT_PRICE_CENTS = 999  # 9.99€ fallback se Stripe não disponível
        for ref in referrals:
            ref_user = db.query(models.User).filter(models.User.id == ref.referred_user_id).first()
            amount_cents = DEFAULT_PRICE_CENTS
            price_id = None
            if ref_user and ref_user.stripe_subscription_id and settings.STRIPE_API_KEY:
                try:
                    sub = stripe.Subscription.retrieve(ref_user.stripe_subscription_id)
                    items = getattr(sub, 'items', None)
                    if items and hasattr(items, 'data') and items.data:
                        price = getattr(items.data[0], 'price', None) or (items.data[0].get('price') if isinstance(items.data[0], dict) else None)
                        if price:
                            price_id = getattr(price, 'id', None) or (price.get('id') if isinstance(price, dict) else None)
                            amt = getattr(price, 'unit_amount', None) or (price.get('unit_amount') if isinstance(price, dict) else None)
                            if amt is not None:
                                amount_cents = int(amt)
                except Exception as e:
                    logger.debug(f"Stripe subscription retrieve falhou para referral {ref.id}, usando fallback: {e}")
            pct = get_commission_percentage_for_price_id(price_id or '', db)
            total_revenue += amount_cents
            total_commission += int(amount_cents * (pct / 100))

        # Percentagem efetiva (para exibição) = total_commission / total_revenue * 100
        effective_pct = (total_commission / total_revenue * 100) if total_revenue else 0.0
        
        commission = models.AffiliateCommission(
            affiliate_id=affiliate.id,
            month=month_date,
            total_revenue_cents=total_revenue,
            commission_percentage=round(effective_pct, 2),
            commission_amount_cents=total_commission,
            referrals_count=len(referrals),
            conversions_count=len(referrals)
        )
        db.add(commission)
        calculated_count += 1
    
    db.commit()
    
    await log_action(
        db,
        action='admin_calculate_commissions',
        user_id=admin.id,
        details=f'Comissões calculadas para {month}: {calculated_count} afiliados',
        request=request
    )
    
    return {
        'message': f'Comissões calculadas para {month}',
        'affiliates_processed': calculated_count,
        'month': month
    }

@router.post('/affiliates/send-monthly-emails')
async def send_monthly_affiliate_emails(
    request: Request,
    month: Optional[str] = None,
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """Envia emails mensais para admin e afiliados"""
    from datetime import datetime
    from ..core.email_translations import get_email_translation
    
    if not month:
        last_month = datetime.now(timezone.utc).replace(day=1) - timedelta(days=1)
        month = last_month.strftime('%Y-%m')
    
    month_date = datetime.strptime(month, '%Y-%m').date().replace(day=1)
    
    # Buscar email do admin
    admin_email = settings.ADMIN_EMAIL or admin.email
    
    # Buscar todas as comissões do mês (pagas e não pagas) e calcular pendente real por invoice.
    commissions = db.query(models.AffiliateCommission).filter(
        models.AffiliateCommission.month == month_date
    ).all()
    
    if not commissions:
        return {'message': f'Nenhuma comissão encontrada para {month}'}
    
    # Preparar dados para email do admin
    admin_data = []
    total_payout = 0
    stripe_invoice_cache: Dict[str, bool] = {}
    for comm in commissions:
        pending_cents = _get_pending_commission_cents_for_month(
            db=db,
            affiliate_id=comm.affiliate_id,
            month_date=month_date,
            monthly_commission_cents=int(comm.commission_amount_cents or 0),
            stripe_invoice_cache=stripe_invoice_cache,
        )
        if pending_cents <= 0:
            continue
        affiliate = db.query(models.User).filter(models.User.id == comm.affiliate_id).first()
        if affiliate:
            admin_data.append({
                'email': affiliate.email,
                'full_name': affiliate.full_name or 'N/A',
                'code': affiliate.affiliate_code,
                'revenue_cents': comm.total_revenue_cents,
                'commission_cents': pending_cents,
                'conversions': comm.conversions_count
            })
            total_payout += pending_cents

    if not admin_data:
        return {'message': f'Nenhuma comissão pendente para {month}'}
    
    # Enviar email para admin
    fm = FastMail(conf)
    
    admin_html = f"""
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; background-color: #020617; color: #94a3b8; padding: 40px;">
        <div style="max-width: 800px; margin: 0 auto; background-color: #0f172a; border-radius: 24px; padding: 40px; border: 1px solid #1e293b;">
            <h2 style="color: #ffffff; margin-top: 0;">Relatório Mensal de Afiliados - {month}</h2>
            <p>Total a pagar: €{total_payout / 100:.2f}</p>
            <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
                <tr style="background-color: #1e293b;">
                    <th style="padding: 10px; text-align: left; border: 1px solid #334155;">Afiliado</th>
                    <th style="padding: 10px; text-align: left; border: 1px solid #334155;">Código</th>
                    <th style="padding: 10px; text-align: right; border: 1px solid #334155;">Receita</th>
                    <th style="padding: 10px; text-align: right; border: 1px solid #334155;">Comissão</th>
                    <th style="padding: 10px; text-align: center; border: 1px solid #334155;">Conversões</th>
                </tr>
    """
    
    for data in admin_data:
        admin_html += f"""
                <tr>
                    <td style="padding: 10px; border: 1px solid #334155;">{data['full_name']} ({data['email']})</td>
                    <td style="padding: 10px; border: 1px solid #334155;">{data['code']}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #334155;">€{data['revenue_cents'] / 100:.2f}</td>
                    <td style="padding: 10px; text-align: right; border: 1px solid #334155;">€{data['commission_cents'] / 100:.2f}</td>
                    <td style="padding: 10px; text-align: center; border: 1px solid #334155;">{data['conversions']}</td>
                </tr>
        """
    
    admin_html += """
            </table>
        </div>
    </body>
    </html>
    """
    
    try:
        admin_message = MessageSchema(
            subject=f'Relatório Mensal de Afiliados - {month}',
            recipients=[admin_email],
            body=admin_html,
            subtype=MessageType.html
        )
        await fm.send_message(admin_message)
        logger.info(f'Email mensal enviado para admin: {admin_email}')
    except Exception as e:
        logger.error(f'Erro ao enviar email para admin: {e}')
    
    # Enviar emails para cada afiliado
    sent_count = 0
    for comm in commissions:
        pending_cents = _get_pending_commission_cents_for_month(
            db=db,
            affiliate_id=comm.affiliate_id,
            month_date=month_date,
            monthly_commission_cents=int(comm.commission_amount_cents or 0),
            stripe_invoice_cache=stripe_invoice_cache,
        )
        if pending_cents <= 0:
            continue
        affiliate = db.query(models.User).filter(models.User.id == comm.affiliate_id).first()
        if not affiliate:
            continue
        
        # Buscar referências do mês
        referrals = db.query(models.AffiliateReferral).filter(
            and_(
                models.AffiliateReferral.referrer_id == affiliate.id,
                models.AffiliateReferral.has_subscribed == True,
                func.date_trunc('month', models.AffiliateReferral.subscription_date) == month_date
            )
        ).all()
        
        user_lang = getattr(affiliate, 'language', 'pt') or 'pt'
        if user_lang not in ['pt', 'en']:
            user_lang = 'pt'
        
        referrals_list = ""
        for ref in referrals:
            referred_user = db.query(models.User).filter(models.User.id == ref.referred_user_id).first()
            referrals_list += f"<li>{referred_user.email if referred_user else 'N/A'} - {ref.subscription_date.strftime('%d/%m/%Y') if ref.subscription_date else 'N/A'}</li>"
        
        affiliate_html = f"""
        <!DOCTYPE html>
        <html>
        <body style="font-family: sans-serif; background-color: #020617; color: #94a3b8; padding: 40px;">
            <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 24px; padding: 40px; border: 1px solid #1e293b;">
                <h2 style="color: #ffffff; margin-top: 0;">Relatório Mensal de Afiliado - {month}</h2>
                <p>Olá {affiliate.full_name or 'Afiliado'},</p>
                <p>Este é o teu relatório mensal de afiliado:</p>
                <ul>
                    <li><strong>Total de conversões:</strong> {comm.conversions_count}</li>
                    <li><strong>Receita gerada:</strong> €{comm.total_revenue_cents / 100:.2f}</li>
                    <li><strong>Comissão pendente a receber:</strong> €{pending_cents / 100:.2f}</li>
                </ul>
                <h3 style="color: #ffffff;">Utilizadores que subscreveram:</h3>
                <ul>
                    {referrals_list if referrals_list else '<li>Nenhuma conversão este mês</li>'}
                </ul>
                <p style="margin-top: 30px; font-size: 12px; color: #475569;">
                    Obrigado por fazeres parte do nosso programa de afiliados!
                </p>
            </div>
        </body>
        </html>
        """
        
        try:
            affiliate_message = MessageSchema(
                subject=f'Relatório Mensal de Afiliado - {month}',
                recipients=[affiliate.email],
                body=affiliate_html,
                subtype=MessageType.html
            )
            await fm.send_message(affiliate_message)
            sent_count += 1
            logger.info(f'Email mensal enviado para afiliado: {affiliate.email}')
        except Exception as e:
            logger.error(f'Erro ao enviar email para afiliado {affiliate.email}: {e}')
    
    await log_action(
        db,
        action='admin_send_monthly_emails',
        user_id=admin.id,
        details=f'Emails mensais enviados para {month}: {sent_count} afiliados',
        request=request
    )
    
    return {
        'message': f'Emails enviados para {month}',
        'admin_email_sent': True,
        'affiliates_emails_sent': sent_count,
        'month': month
    }


# ── Admin Support Chat ──

@router.get('/support/conversations')
async def admin_list_support_conversations(
    status_filter: Optional[str] = Query(None),
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db),
):
    q = db.query(models.SupportConversation).order_by(models.SupportConversation.updated_at.desc())
    if status_filter in ('open', 'closed'):
        q = q.filter(models.SupportConversation.status == status_filter)

    unread_subq = (
        db.query(
            models.SupportMessage.conversation_id.label('cid'),
            func.count(models.SupportMessage.id).label('unread_count'),
        )
        .filter(
            models.SupportMessage.sender_type == 'user',
            models.SupportMessage.is_read == False,
        )
        .group_by(models.SupportMessage.conversation_id)
        .subquery()
    )

    last_msg_time_subq = (
        db.query(
            models.SupportMessage.conversation_id.label('cid'),
            func.max(models.SupportMessage.created_at).label('last_created_at'),
        )
        .group_by(models.SupportMessage.conversation_id)
        .subquery()
    )

    last_msg_subq = (
        db.query(
            models.SupportMessage.conversation_id.label('cid'),
            models.SupportMessage.content.label('last_content'),
        )
        .join(
            last_msg_time_subq,
            and_(
                models.SupportMessage.conversation_id == last_msg_time_subq.c.cid,
                models.SupportMessage.created_at == last_msg_time_subq.c.last_created_at,
            ),
        )
        .subquery()
    )

    rows = (
        db.query(
            models.SupportConversation,
            func.coalesce(unread_subq.c.unread_count, 0).label('unread_count'),
            last_msg_subq.c.last_content.label('last_content'),
        )
        .outerjoin(unread_subq, unread_subq.c.cid == models.SupportConversation.id)
        .outerjoin(last_msg_subq, last_msg_subq.c.cid == models.SupportConversation.id)
        .filter(models.SupportConversation.status == status_filter if status_filter in ('open', 'closed') else True)
        .order_by(models.SupportConversation.updated_at.desc())
        .all()
    )

    user_ids = set()
    for c, _, _ in rows:
        if c.user_id:
            user_ids.add(c.user_id)
        if c.assigned_to:
            user_ids.add(c.assigned_to)
    users_map = {
        u.id: u
        for u in db.query(models.User).filter(models.User.id.in_(list(user_ids))).all()
    } if user_ids else {}

    results = []
    for c, unread_count, last_content in rows:
        user = users_map.get(c.user_id)
        assignee = None
        if c.assigned_to:
            a = users_map.get(c.assigned_to)
            assignee = {'id': str(a.id), 'name': a.full_name or a.email, 'email': a.email} if a else None
        results.append({
            'id': str(c.id),
            'subject': c.subject,
            'status': c.status,
            'created_at': c.created_at.isoformat(),
            'updated_at': c.updated_at.isoformat(),
            'unread_count': int(unread_count or 0),
            'last_message': (last_content or '')[:100] if last_content else None,
            'user_email': user.email if user else 'unknown',
            'user_name': (user.full_name or '') if user else '',
            'assigned_to': assignee,
        })
    return results


@router.get('/support/conversations/{conversation_id}/messages')
async def admin_get_conversation_messages(
    conversation_id: str,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db),
):
    try:
        cid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail='ID inválido')

    convo = db.query(models.SupportConversation).filter(models.SupportConversation.id == cid).first()
    if not convo:
        raise HTTPException(status_code=404, detail='Conversa não encontrada')

    db.query(models.SupportMessage).filter(
        models.SupportMessage.conversation_id == cid,
        models.SupportMessage.sender_type == 'user',
        models.SupportMessage.is_read == False,
    ).update({'is_read': True})
    db.commit()

    msgs = (
        db.query(models.SupportMessage)
        .filter(models.SupportMessage.conversation_id == cid)
        .order_by(models.SupportMessage.created_at.asc())
        .all()
    )

    user = db.query(models.User).filter(models.User.id == convo.user_id).first()
    assignee_info = None
    if convo.assigned_to:
        a = db.query(models.User).filter(models.User.id == convo.assigned_to).first()
        assignee_info = {'id': str(a.id), 'name': a.full_name or a.email} if a else None
    return {
        'conversation': {
            'id': str(convo.id),
            'subject': convo.subject,
            'status': convo.status,
            'user_email': user.email if user else 'unknown',
            'user_name': (user.full_name or '') if user else '',
            'assigned_to': assignee_info,
        },
        'messages': [
            {
                'id': str(m.id),
                'sender_type': m.sender_type,
                'content': m.content,
                'image_url': m.image_url,
                'is_read': m.is_read,
                'is_auto': bool(m.sender_type == 'admin' and m.sender_id is None),
                'created_at': m.created_at.isoformat(),
                'sender_name': None,
            }
            for m in msgs
        ],
    }


@router.post('/support/conversations/{conversation_id}/reply')
async def admin_reply_to_conversation(
    conversation_id: str,
    body: schemas.SupportAdminReply,
    request: Request,
    background_tasks: BackgroundTasks,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db),
):
    try:
        cid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail='ID inválido')

    convo = db.query(models.SupportConversation).filter(models.SupportConversation.id == cid).first()
    if not convo:
        raise HTTPException(status_code=404, detail='Conversa não encontrada')

    # Auto-assign to first admin who replies (warn if already assigned to someone else)
    if convo.assigned_to and convo.assigned_to != admin.id:
        other = db.query(models.User).filter(models.User.id == convo.assigned_to).first()
        other_name = (other.full_name or other.email) if other else 'outro admin'
        raise HTTPException(
            status_code=409,
            detail=f'Esta conversa está atribuída a {other_name}. Usa "Assumir" para a transferir para ti.'
        )

    if not convo.assigned_to:
        convo.assigned_to = admin.id

    msg = models.SupportMessage(
        conversation_id=cid,
        sender_type='admin',
        sender_id=admin.id,
        content=body.content,
    )
    convo.updated_at = func.now()
    db.add(msg)
    db.commit()
    db.refresh(msg)
    # Notificar o utilizador (email, com throttle) de que o suporte respondeu.
    try:
        from .support import notify_user_of_admin_reply
        notify_user_of_admin_reply(background_tasks, db, cid, body.content)
    except Exception as e:
        logger.warning(f'Falha ao agendar notificação de resposta ao utilizador: {e}')
    await log_action(
        db,
        action='admin_support_reply',
        user_id=admin.id,
        details=f'Resposta enviada na conversa {conversation_id}',
        request=request,
    )
    return {'message_id': str(msg.id), 'assigned_to': str(admin.id)}


@router.post('/support/conversations/{conversation_id}/assign')
async def admin_assign_conversation(
    conversation_id: str,
    request: Request,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db),
):
    try:
        cid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail='ID inválido')

    convo = db.query(models.SupportConversation).filter(models.SupportConversation.id == cid).first()
    if not convo:
        raise HTTPException(status_code=404, detail='Conversa não encontrada')

    convo.assigned_to = admin.id
    db.commit()
    await log_action(
        db,
        action='admin_support_assign',
        user_id=admin.id,
        details=f'Conversa {conversation_id} atribuída ao admin',
        request=request,
    )
    return {'ok': True, 'assigned_to': str(admin.id)}


@router.patch('/support/conversations/{conversation_id}/close')
async def admin_close_conversation(
    conversation_id: str,
    request: Request,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db),
):
    try:
        cid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail='ID inválido')

    convo = db.query(models.SupportConversation).filter(models.SupportConversation.id == cid).first()
    if not convo:
        raise HTTPException(status_code=404, detail='Conversa não encontrada')

    convo.status = 'closed'
    db.commit()
    await log_action(
        db,
        action='admin_support_close',
        user_id=admin.id,
        details=f'Conversa {conversation_id} fechada',
        request=request,
    )
    return {'ok': True}


@router.delete('/support/conversations/{conversation_id}')
async def admin_delete_conversation(
    conversation_id: str,
    request: Request,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db),
):
    try:
        cid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail='ID inválido')

    convo = db.query(models.SupportConversation).filter(models.SupportConversation.id == cid).first()
    if not convo:
        raise HTTPException(status_code=404, detail='Conversa não encontrada')

    db.delete(convo)
    db.commit()
    await log_action(
        db,
        action='admin_support_delete',
        user_id=admin.id,
        details=f'Conversa {conversation_id} eliminada',
        request=request,
    )
    return {'ok': True}


@router.post('/support/conversations/{conversation_id}/ai-suggest')
async def admin_ai_suggest_reply(
    conversation_id: str,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db),
):
    """Uses AI to generate a suggested reply based on the conversation history."""
    try:
        cid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail='ID inválido')

    convo = db.query(models.SupportConversation).filter(models.SupportConversation.id == cid).first()
    if not convo:
        raise HTTPException(status_code=404, detail='Conversa não encontrada')

    msgs = (
        db.query(models.SupportMessage)
        .filter(models.SupportMessage.conversation_id == cid)
        .order_by(models.SupportMessage.created_at.asc())
        .all()
    )

    user = db.query(models.User).filter(models.User.id == convo.user_id).first()
    user_info = f"User: {user.email}" if user else "User: unknown"

    chat_history = "\n".join([
        f"{'User' if m.sender_type == 'user' else 'Admin (tu)'}: {m.content}"
        for m in msgs[-15:]
    ])

    system_prompt = f"""És o assistente de suporte da Finly, uma plataforma SaaS de gestão financeira pessoal.
Estás a gerar uma sugestão de resposta para o ADMIN enviar ao utilizador.

Regras:
- Responde em português de Portugal (não brasileiro)
- Sê conciso mas completo
- Mantém um tom profissional mas amigável
- Não uses emojis em excesso

Comportamento inteligente:
- Se o utilizador reportou um BUG: pede detalhes (página, ação, browser) e pede screenshot se ainda não enviou
- Se reportou erro: pede mensagem de erro exata e passos para reproduzir
- Se é uma dúvida: explica com passos claros
- Se é pedido de funcionalidade: agradece e diz que vai ser avaliada
- Se é sobre faturação/pagamentos: verifica internamente antes de responder
- Se é parceria/negócio: sê profissional e diz que a equipa vai analisar
- FAZ PERGUNTAS quando precisas de mais contexto — não dês respostas vagas
- Se não souberes resolver, sugere que vais investigar e dar resposta concreta

{user_info}

Histórico da conversa:
{chat_history}

Gera APENAS o texto da resposta, sem prefixos como "Admin:" ou aspas."""

    try:
        from openai import OpenAI
        client = OpenAI(api_key=settings.OPENAI_API_KEY)
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "system", "content": system_prompt}],
            max_tokens=500,
            temperature=0.7,
        )
        suggestion = response.choices[0].message.content.strip()
        return {'suggestion': suggestion}
    except Exception as e:
        logger.error(f"AI suggest error: {e}")
        raise HTTPException(status_code=500, detail='Erro ao gerar sugestão IA')


@router.get('/support/auto-reply')
async def admin_get_auto_reply(
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db),
):
    setting = db.query(models.AppSetting).filter(models.AppSetting.key == 'support_auto_reply').first()
    return {'enabled': setting.value == '1' if setting else False}


@router.post('/support/auto-reply')
async def admin_set_auto_reply(
    body: dict,
    request: Request,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db),
):
    enabled = body.get('enabled', False)
    setting = db.query(models.AppSetting).filter(models.AppSetting.key == 'support_auto_reply').first()
    if setting:
        setting.value = '1' if enabled else '0'
    else:
        db.add(models.AppSetting(key='support_auto_reply', value='1' if enabled else '0'))
    db.commit()
    await log_action(
        db,
        action='admin_support_auto_reply_toggle',
        user_id=admin.id,
        details=f'Auto-reply suporte: {"ativado" if enabled else "desativado"}',
        request=request,
    )
    return {'enabled': enabled}


@router.get('/support/unread-total')
async def admin_total_unread(
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db),
):
    count = (
        db.query(func.count(models.SupportMessage.id))
        .join(models.SupportConversation, models.SupportMessage.conversation_id == models.SupportConversation.id)
        .filter(
            models.SupportMessage.sender_type == 'user',
            models.SupportMessage.is_read == False,
        )
        .scalar()
    )
    return {'unread': count or 0}


@router.post('/support/conversations/{conversation_id}/typing')
async def admin_set_typing(
    conversation_id: str,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db),
):
    try:
        cid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail='ID inválido')
    convo = db.query(models.SupportConversation).filter(models.SupportConversation.id == cid).first()
    if not convo:
        raise HTTPException(status_code=404, detail='Conversa não encontrada')
    from .support import _typing_status
    import time
    _typing_status.setdefault(conversation_id, {})['admin'] = time.time()
    return {"ok": True}


@router.get('/support/conversations/{conversation_id}/typing')
async def admin_get_typing(
    conversation_id: str,
    admin: models.User = Depends(check_admin),
    db: Session = Depends(get_db),
):
    try:
        cid = UUID(conversation_id)
    except ValueError:
        raise HTTPException(status_code=400, detail='ID inválido')
    convo = db.query(models.SupportConversation).filter(models.SupportConversation.id == cid).first()
    if not convo:
        raise HTTPException(status_code=404, detail='Conversa não encontrada')
    from .support import _typing_status, TYPING_TTL
    import time
    status = _typing_status.get(conversation_id, {})
    user_typing = (time.time() - status.get('user', 0)) < TYPING_TTL
    return {"typing": user_typing}
