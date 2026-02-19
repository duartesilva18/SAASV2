from fastapi import APIRouter, Depends, HTTPException, status, Request, Query
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, and_, desc
from typing import List, Optional
from uuid import UUID
from datetime import datetime, date, timedelta, timezone
from decimal import Decimal
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

import json

logger = logging.getLogger(__name__)

stripe.api_key = settings.STRIPE_API_KEY

router = APIRouter(prefix='/admin', tags=['admin'])

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


@router.get('/finance/stats')
async def get_admin_finance_stats(db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    try:
        from datetime import datetime, timedelta
        from collections import defaultdict

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
        now = datetime.now()

        for inv in invoices.data:
            if inv.status == 'paid' and inv.created:
                net = _invoice_net_paid(inv)
                if net <= 0:
                    continue
                if isinstance(inv.created, (int, float)):
                    inv_date = datetime.fromtimestamp(inv.created)
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

        return {
            'total_mrr_cents': total_mrr,
            'total_revenue_cents': total_revenue,
            'active_subscriptions': len(unique_customers),
            'pending_invoices_count': len(pending_invoices),
            'monthly_revenue': monthly_data
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f'Stripe error: {str(e)}')

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
    db: Session = Depends(get_db), 
    admin: models.User = Depends(check_admin)
):
    limit = min(max(limit, 1), 100)  # Cap entre 1 e 100
    page = max(page, 1)
    query = db.query(models.AuditLog).options(joinedload(models.AuditLog.user))
    
    if action and action != 'all':
        query = query.filter(models.AuditLog.action.contains(action))
        
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
                "created_at": log.created_at,
            }
        )

    return {
        "logs": logs_payload,
        "total": total,
        "page": page,
        "pages": (total + limit - 1) // limit
    }

@router.get('/users', response_model=List[schemas.AdminUserResponse])
async def get_admin_users(db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()

@router.get('/users/{user_id}', response_model=schemas.AdminUserDetail)
async def get_user_detail(user_id: UUID, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')
    
    workspaces = db.query(models.Workspace).filter(models.Workspace.owner_id == user_id).all()
    logs = db.query(models.AuditLog).filter(models.AuditLog.user_id == user_id).order_by(models.AuditLog.created_at.desc()).limit(50).all()
    
    return schemas.AdminUserDetail(
        **schemas.AdminUserResponse.from_orm(user).dict(),
        workspaces=workspaces,
        logs=logs
    )

@router.post('/users/{user_id}/toggle-admin')
async def toggle_admin_status(user_id: UUID, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail='Não podes alterar o teu próprio estado de admin.')
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')
    
    user.is_admin = not user.is_admin
    db.commit()
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

@router.post('/marketing/broadcast')
async def send_marketing_broadcast(
    request: Request,
    broadcast: schemas.BroadcastRequest,
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    # Find all users who opted in for marketing
    users = db.query(models.User).filter(models.User.marketing_opt_in == True).all()
    
    if not users:
        return {"message": "Nenhum utilizador com marketing opt-in encontrado.", "count": 0}

    sent_count = 0
    
    fm = FastMail(conf)
    
    for user in users:
        try:
            logger.info(f"A preparar envio de broadcast para: {user.email}")
            # Get user language preference from user model or default to 'pt'
            user_lang = getattr(user, 'language', 'pt') or 'pt'
            # Validate language (only 'pt' or 'en' supported)
            if user_lang not in ['pt', 'en']:
                user_lang = 'pt'
            t = get_email_translation(user_lang)
            marketing_footer = t.get('marketing_footer', 'Recebeu este email porque aceitou as comunicações de marketing do Finly.')
            
            import html as html_module
            safe_subject = html_module.escape(broadcast.subject)
            # Converter newlines em <br> na mensagem, mas escapar o resto
            safe_message = html_module.escape(broadcast.message).replace('\n', '<br>')
            safe_footer = html_module.escape(marketing_footer)
            html = f"""
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
            message = MessageSchema(
                subject=broadcast.subject,
                recipients=[user.email],
                body=html,
                subtype=MessageType.html
            )
            await fm.send_message(message)
            logger.info(f"SUCCESS: Email de broadcast enviado para: {user.email}")
            sent_count += 1
        except Exception as e:
            logger.error(f"ERROR: Falha ao enviar broadcast para {user.email}: {str(e)}")

    # Guardar os detalhes completos no Log de Auditoria
    log_details = json.dumps({
        "subject": broadcast.subject,
        "message": broadcast.message,
        "sent_count": sent_count
    }, ensure_ascii=False)

    await log_action(
        db, 
        action='marketing_broadcast', 
        user_id=admin.id, 
        details=log_details, 
        request=request
    )

    return {
        "message": "Broadcast de email concluído com sucesso",
        "total_users": len(users),
        "sent": sent_count
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
    search: Optional[str] = Query(None, description="Pesquisar por email ou nome")
):
    """Retorna todos os utilizadores que ainda não são afiliados (para promover)"""
    query = db.query(models.User).filter(models.User.is_affiliate == False)
    
    if search:
        search_term = f"%{search}%"
        query = query.filter(
            (models.User.email.ilike(search_term)) |
            (models.User.full_name.ilike(search_term))
        )
    
    users = query.order_by(models.User.created_at.desc()).limit(50).all()
    
    return [{
        'user_id': str(u.id),
        'email': u.email,
        'full_name': u.full_name,
        'created_at': u.created_at.isoformat() if u.created_at else None
    } for u in users]

@router.get('/affiliates', response_model=List[schemas.AdminAffiliateResponse])
async def get_all_affiliates(
    db: Session = Depends(get_db),
    admin: models.User = Depends(check_admin)
):
    """Lista todos os afiliados"""
    affiliates = db.query(models.User).filter(models.User.is_affiliate == True).all()
    
    result = []
    for aff in affiliates:
        total_referrals = db.query(func.count(models.AffiliateReferral.id)).filter(
            models.AffiliateReferral.referrer_id == aff.id
        ).scalar() or 0
        
        total_conversions = db.query(func.count(models.AffiliateReferral.id)).filter(
            and_(
                models.AffiliateReferral.referrer_id == aff.id,
                models.AffiliateReferral.has_subscribed == True
            )
        ).scalar() or 0
        
        total_earnings = db.query(func.sum(models.AffiliateCommission.commission_amount_cents)).filter(
            models.AffiliateCommission.affiliate_id == aff.id
        ).scalar() or 0
        
        result.append(schemas.AdminAffiliateResponse(
            user_id=aff.id,
            email=aff.email,
            full_name=aff.full_name,
            affiliate_code=aff.affiliate_code,
            is_affiliate=aff.is_affiliate,
            total_referrals=total_referrals,
            total_conversions=total_conversions,
            total_earnings_cents=int(total_earnings),
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
    
    result = []
    for aff, conversions in affiliates:
        total_referrals = db.query(func.count(models.AffiliateReferral.id)).filter(
            models.AffiliateReferral.referrer_id == aff.id
        ).scalar() or 0
        
        total_earnings = db.query(func.sum(models.AffiliateCommission.commission_amount_cents)).filter(
            models.AffiliateCommission.affiliate_id == aff.id
        ).scalar() or 0
        
        result.append(schemas.AdminAffiliateResponse(
            user_id=aff.id,
            email=aff.email,
            full_name=aff.full_name,
            affiliate_code=aff.affiliate_code,
            is_affiliate=aff.is_affiliate,
            total_referrals=total_referrals,
            total_conversions=conversions,
            total_earnings_cents=int(total_earnings),
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
    except Exception as e:
        logger.error(f'Erro ao buscar stats de afiliados: {str(e)}', exc_info=True)
        raise HTTPException(status_code=500, detail=f'Erro ao buscar estatísticas: {str(e)}')

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
    except Exception as e:
        logger.error(f'Erro ao buscar timeline de receita: {str(e)}', exc_info=True)
        raise HTTPException(status_code=500, detail=f'Erro ao buscar timeline: {str(e)}')

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
        raise HTTPException(status_code=500, detail=f'Erro ao buscar receita: {str(e)}')

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
        last_month = datetime.now().replace(day=1) - timedelta(days=1)
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
        last_month = datetime.now().replace(day=1) - timedelta(days=1)
        month = last_month.strftime('%Y-%m')
    
    month_date = datetime.strptime(month, '%Y-%m').date().replace(day=1)
    
    # Buscar email do admin
    admin_email = settings.ADMIN_EMAIL or admin.email
    
    # Buscar todas as comissões do mês
    commissions = db.query(models.AffiliateCommission).filter(
        models.AffiliateCommission.month == month_date
    ).all()
    
    if not commissions:
        return {'message': f'Nenhuma comissão encontrada para {month}'}
    
    # Preparar dados para email do admin
    admin_data = []
    total_payout = 0
    for comm in commissions:
        affiliate = db.query(models.User).filter(models.User.id == comm.affiliate_id).first()
        if affiliate:
            admin_data.append({
                'email': affiliate.email,
                'full_name': affiliate.full_name or 'N/A',
                'code': affiliate.affiliate_code,
                'revenue_cents': comm.total_revenue_cents,
                'commission_cents': comm.commission_amount_cents,
                'conversions': comm.conversions_count
            })
            total_payout += comm.commission_amount_cents
    
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
                    <li><strong>Comissão a receber:</strong> €{comm.commission_amount_cents / 100:.2f}</li>
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
