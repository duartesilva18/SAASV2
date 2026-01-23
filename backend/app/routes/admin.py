from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from uuid import UUID
from ..core.dependencies import get_db, conf
from ..models import database as models
from .. import schemas
from .auth import get_current_user
from ..core.audit import log_action
import stripe
from ..core.config import settings
from fastapi_mail import FastMail, MessageSchema, MessageType
from ..core.email_translations import get_email_translation
import logging
import requests

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

@router.get('/finance/stats')
async def get_admin_finance_stats(db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    try:
        from datetime import datetime, timedelta
        from collections import defaultdict
        
        subscriptions = stripe.Subscription.list(limit=100)
        invoices = stripe.Invoice.list(limit=100)
        
        total_mrr = sum(sub.plan.amount for sub in subscriptions.data if sub.plan)
        total_revenue = sum(inv.amount_paid for inv in invoices.data if inv.status == 'paid')
        
        pending_invoices = [inv for inv in invoices.data if inv.status == 'open' and inv.attempt_count > 0]
        
        # Contar apenas utilizadores únicos com subscrições ativas (não subscrições múltiplas)
        unique_customers = set()
        for sub in subscriptions.data:
            if sub.status in ['active', 'trialing']:
                unique_customers.add(sub.customer)
        
        # Calcular faturamento mensal dos últimos 12 meses
        monthly_revenue = defaultdict(int)
        now = datetime.now()
        
        for inv in invoices.data:
            if inv.status == 'paid' and inv.created:
                # Converter timestamp Unix para datetime (Stripe retorna Unix timestamp)
                if isinstance(inv.created, (int, float)):
                    inv_date = datetime.fromtimestamp(inv.created)
                else:
                    # Se já for datetime object
                    inv_date = inv.created
                # Agrupar por mês/ano
                month_key = inv_date.strftime('%Y-%m')
                monthly_revenue[month_key] += inv.amount_paid
        
        # Criar lista dos últimos 12 meses com valores
        monthly_data = []
        for i in range(11, -1, -1):  # Últimos 12 meses
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
            'active_subscriptions': len(unique_customers),  # Contar utilizadores únicos
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
    active_subscriptions = db.query(func.count(models.User.id)).filter(models.User.subscription_status != 'none').scalar()
    
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

@router.get('/audit-logs')
async def get_audit_logs(
    page: int = 1, 
    limit: int = 20, 
    action: str = None, 
    db: Session = Depends(get_db), 
    admin: models.User = Depends(check_admin)
):
    query = db.query(models.AuditLog)
    
    if action and action != 'all':
        query = query.filter(models.AuditLog.action.contains(action))
        
    total = query.count()
    logs = query.order_by(models.AuditLog.created_at.desc()).offset((page - 1) * limit).limit(limit).all()
    
    # SQLAlchemy will handle the relationship if it's defined in the model
    # and the schema has 'user: UserResponse'
    
    return {
        "logs": logs,
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
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')
    
    user.is_admin = not user.is_admin
    db.commit()
    return {'message': f"Admin status for {user.email} updated to {user.is_admin}"}

@router.put('/users/{user_id}', response_model=schemas.AdminUserResponse)
async def update_user_admin(request: Request, user_id: UUID, user_update: schemas.AdminUserUpdate, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    user = db.query(models.User).filter(models.User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail='Utilizador não encontrado')
    
    update_data = user_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(user, field, value)
    
    db.commit()
    db.refresh(user)
    
    await log_action(db, action='admin_user_update', user_id=admin.id, details=f'Updated user: {user.email}', request=request)
    return user

@router.delete('/users/{user_id}')
async def delete_user_admin(request: Request, user_id: UUID, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
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

@router.post('/settings')
async def update_system_setting(data: dict, db: Session = Depends(get_db), admin: models.User = Depends(check_admin)):
    for key, value in data.items():
        setting = db.query(models.SystemSetting).filter(models.SystemSetting.key == key).first()
        if setting:
            setting.value = str(value)
        else:
            setting = models.SystemSetting(key=key, value=str(value))
            db.add(setting)
    db.commit()
    return {"message": "Definições atualizadas"}

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
            
            html = f"""
            <!DOCTYPE html>
            <html>
            <body style="font-family: sans-serif; background-color: #020617; color: #94a3b8; padding: 40px;">
                <div style="max-width: 600px; margin: 0 auto; background-color: #0f172a; border-radius: 24px; padding: 40px; border: 1px solid #1e293b;">
                    <h2 style="color: #ffffff; margin-top: 0;">{broadcast.subject}</h2>
                    <p style="line-height: 1.6; font-size: 16px;">{broadcast.message}</p>
                    <hr style="border: 0; border-top: 1px solid #1e293b; margin: 30px 0;">
                    <p style="font-size: 12px; color: #475569;">{marketing_footer}</p>
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
