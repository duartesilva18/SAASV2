from fastapi import APIRouter, Depends, HTTPException, status, Request
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
from typing import List
from uuid import UUID
from datetime import datetime, timedelta, date, timezone
from collections import defaultdict
from ..core.dependencies import get_db
from ..models import database as models
from .. import schemas
from .auth import get_current_user
from ..core.audit import log_action
from ..core.config import settings
import secrets
import logging
import stripe

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/affiliate', tags=['affiliate'])

def generate_affiliate_code() -> str:
    """Gera um código único de afiliado (8 caracteres alfanuméricos)"""
    while True:
        code = secrets.token_urlsafe(6).upper()[:8].replace('-', '').replace('_', '')
        # Garantir que tem pelo menos uma letra e um número
        if any(c.isalpha() for c in code) and any(c.isdigit() for c in code):
            return code

@router.get('/status', response_model=schemas.AffiliateResponse)
async def get_affiliate_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna o status do afiliado do utilizador atual"""
    from ..core.config import settings
    
    # Verificar se o utilizador tem 5+ meses de criação
    # Garantir que created_at seja timezone-aware
    try:
        created_at = current_user.created_at
        if created_at is None:
            # Se não houver created_at, assumir que é novo (0 meses)
            months_since_creation = 0
        else:
            # Converter para timezone-aware se necessário
            if created_at.tzinfo is None:
                # Se for naive, assumir UTC
                created_at = created_at.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            months_since_creation = (now - created_at).days / 30
    except (TypeError, AttributeError) as e:
        # Em caso de erro, assumir 0 meses
        logger.warning(f"Erro ao calcular meses desde criação: {e}")
        months_since_creation = 0
    
    if not current_user.is_affiliate:
        return schemas.AffiliateResponse(
            is_affiliate=False,
            affiliate_code=None,
            affiliate_link=None,
            total_referrals=0,
            total_conversions=0,
            total_earnings_cents=0,
            pending_earnings_cents=0
        )
    
    # Calcular estatísticas
    total_referrals = db.query(func.count(models.AffiliateReferral.id)).filter(
        models.AffiliateReferral.referrer_id == current_user.id
    ).scalar() or 0
    
    total_conversions = db.query(func.count(models.AffiliateReferral.id)).filter(
        and_(
            models.AffiliateReferral.referrer_id == current_user.id,
            models.AffiliateReferral.has_subscribed == True
        )
    ).scalar() or 0
    
    # Calcular earnings
    total_earnings = db.query(func.sum(models.AffiliateCommission.commission_amount_cents)).filter(
        models.AffiliateCommission.affiliate_id == current_user.id
    ).scalar() or 0
    
    pending_earnings = db.query(func.sum(models.AffiliateCommission.commission_amount_cents)).filter(
        and_(
            models.AffiliateCommission.affiliate_id == current_user.id,
            models.AffiliateCommission.is_paid == False
        )
    ).scalar() or 0
    
    affiliate_link = f"{settings.FRONTEND_URL}/auth/register?ref={current_user.affiliate_code}" if current_user.affiliate_code else None
    
    return schemas.AffiliateResponse(
        is_affiliate=current_user.is_affiliate,
        affiliate_code=current_user.affiliate_code,
        affiliate_link=affiliate_link,
        total_referrals=total_referrals,
        total_conversions=total_conversions,
        total_earnings_cents=int(total_earnings),
        pending_earnings_cents=int(pending_earnings)
    )

@router.post('/request', response_model=schemas.AffiliateResponse)
async def request_affiliate_status(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Solicita para se tornar afiliado - aprova automaticamente se tiver 5+ meses"""
    from ..core.config import settings
    
    # Verificar se já é afiliado
    if current_user.is_affiliate:
        # Se já é afiliado, retornar status atual
        affiliate_link = f"{settings.FRONTEND_URL}/auth/register?ref={current_user.affiliate_code}" if current_user.affiliate_code else None
        total_referrals = db.query(func.count(models.AffiliateReferral.id)).filter(
            models.AffiliateReferral.referrer_id == current_user.id
        ).scalar() or 0
        total_conversions = db.query(func.count(models.AffiliateReferral.id)).filter(
            and_(
                models.AffiliateReferral.referrer_id == current_user.id,
                models.AffiliateReferral.has_subscribed == True
            )
        ).scalar() or 0
        total_earnings = db.query(func.sum(models.AffiliateCommission.commission_amount_cents)).filter(
            models.AffiliateCommission.affiliate_id == current_user.id
        ).scalar() or 0
        pending_earnings = db.query(func.sum(models.AffiliateCommission.commission_amount_cents)).filter(
            and_(
                models.AffiliateCommission.affiliate_id == current_user.id,
                models.AffiliateCommission.is_paid == False
            )
        ).scalar() or 0
        
        return schemas.AffiliateResponse(
            is_affiliate=True,
            affiliate_code=current_user.affiliate_code,
            affiliate_link=affiliate_link,
            total_referrals=total_referrals,
            total_conversions=total_conversions,
            total_earnings_cents=int(total_earnings),
            pending_earnings_cents=int(pending_earnings)
        )
    
    # Verificar se tem 5+ meses
    # Garantir que created_at seja timezone-aware
    try:
        created_at = current_user.created_at
        if created_at is None:
            months_since_creation = 0
        else:
            if created_at.tzinfo is None:
                created_at = created_at.replace(tzinfo=timezone.utc)
            now = datetime.now(timezone.utc)
            months_since_creation = (now - created_at).days / 30
    except (TypeError, AttributeError) as e:
        logger.warning(f"Erro ao calcular meses desde criação: {e}")
        months_since_creation = 0
    if months_since_creation < 5:
        raise HTTPException(
            status_code=400,
            detail=f'Precisas de ter uma conta com pelo menos 5 meses para te tornares afiliado. A tua conta tem {int(months_since_creation)} meses.'
        )
    
    # Se tem 5+ meses, aprovar automaticamente
    # Gerar código único
    if not current_user.affiliate_code:
        code = generate_affiliate_code()
        # Garantir que o código é único
        while db.query(models.User).filter(models.User.affiliate_code == code).first():
            code = generate_affiliate_code()
        current_user.affiliate_code = code
    
    # Marcar como afiliado
    current_user.is_affiliate = True
    current_user.affiliate_requested_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(current_user)
    
    await log_action(
        db,
        action='affiliate_approved',
        user_id=current_user.id,
        details=f'Utilizador {current_user.email} aprovado automaticamente como afiliado (conta com {int(months_since_creation)} meses)',
        request=request
    )
    
    # Retornar status atualizado
    affiliate_link = f"{settings.FRONTEND_URL}/auth/register?ref={current_user.affiliate_code}"
    
    return schemas.AffiliateResponse(
        is_affiliate=True,
        affiliate_code=current_user.affiliate_code,
        affiliate_link=affiliate_link,
        total_referrals=0,
        total_conversions=0,
        total_earnings_cents=0,
        pending_earnings_cents=0
    )

@router.get('/stats', response_model=schemas.AffiliateStats)
async def get_affiliate_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna estatísticas detalhadas do afiliado"""
    if not current_user.is_affiliate:
        raise HTTPException(
            status_code=403,
            detail='Não és afiliado.'
        )
    
    # Total de referências
    total_referrals = db.query(func.count(models.AffiliateReferral.id)).filter(
        models.AffiliateReferral.referrer_id == current_user.id
    ).scalar() or 0
    
    # Total de conversões
    total_conversions = db.query(func.count(models.AffiliateReferral.id)).filter(
        and_(
            models.AffiliateReferral.referrer_id == current_user.id,
            models.AffiliateReferral.has_subscribed == True
        )
    ).scalar() or 0
    
    conversion_rate = (total_conversions / total_referrals * 100) if total_referrals > 0 else 0.0
    
    # Earnings
    total_earnings = db.query(func.sum(models.AffiliateCommission.commission_amount_cents)).filter(
        models.AffiliateCommission.affiliate_id == current_user.id
    ).scalar() or 0
    
    pending_earnings = db.query(func.sum(models.AffiliateCommission.commission_amount_cents)).filter(
        and_(
            models.AffiliateCommission.affiliate_id == current_user.id,
            models.AffiliateCommission.is_paid == False
        )
    ).scalar() or 0
    
    paid_earnings = db.query(func.sum(models.AffiliateCommission.commission_amount_cents)).filter(
        and_(
            models.AffiliateCommission.affiliate_id == current_user.id,
            models.AffiliateCommission.is_paid == True
        )
    ).scalar() or 0
    
    # Lista de referências
    referrals = db.query(models.AffiliateReferral).filter(
        models.AffiliateReferral.referrer_id == current_user.id
    ).order_by(models.AffiliateReferral.created_at.desc()).all()
    
    # Buscar percentagem de comissão atual
    commission_setting = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == 'affiliate_commission_percentage'
    ).first()
    commission_percentage = float(commission_setting.value) if commission_setting else 20.0
    
    # Configurar Stripe
    if settings.STRIPE_API_KEY:
        stripe.api_key = settings.STRIPE_API_KEY
    
    referrals_data = []
    for ref in referrals:
        referred_user = db.query(models.User).filter(models.User.id == ref.referred_user_id).first()
        
        payment_info = None
        if ref.has_subscribed and referred_user:
            try:
                # Tentar buscar pela subscription_id primeiro
                if referred_user.stripe_subscription_id and settings.STRIPE_API_KEY:
                    subscription = stripe.Subscription.retrieve(referred_user.stripe_subscription_id)
                # Se não tiver subscription_id, tentar buscar pelo customer_id
                elif referred_user.stripe_customer_id and settings.STRIPE_API_KEY:
                    subscriptions = stripe.Subscription.list(
                        customer=referred_user.stripe_customer_id,
                        status='all',
                        limit=1
                    )
                    subscription = subscriptions.data[0] if subscriptions.data else None
                else:
                    subscription = None
                
                if subscription and settings.STRIPE_API_KEY:
                    # Buscar última invoice paga
                    invoices = stripe.Invoice.list(
                        subscription=subscription.id,
                        status='paid',
                        limit=1
                    )
                    if invoices.data:
                        invoice = invoices.data[0]
                        plan_info = subscription.items.data[0].price if subscription.items.data else None
                        amount_paid_cents = invoice.amount_paid
                        commission_cents = int(amount_paid_cents * (commission_percentage / 100))
                        payment_info = {
                            'amount_paid_cents': amount_paid_cents,
                            'commission_cents': commission_cents,
                            'commission_percentage': commission_percentage,
                            'currency': invoice.currency,
                            'paid_at': datetime.fromtimestamp(invoice.created).isoformat() if invoice.created else None,
                            'subscription_status': subscription.status,
                            'plan_name': plan_info.nickname if plan_info and plan_info.nickname else (plan_info.product if plan_info else None),
                            'plan_interval': plan_info.recurring.interval if plan_info and plan_info.recurring else None
                        }
                    else:
                        # Se não houver invoice paga, usar informações da subscription
                        plan_info = subscription.items.data[0].price if subscription.items.data else None
                        amount_paid_cents = plan_info.unit_amount if plan_info else 999
                        commission_cents = int(amount_paid_cents * (commission_percentage / 100))
                        payment_info = {
                            'amount_paid_cents': amount_paid_cents,
                            'commission_cents': commission_cents,
                            'commission_percentage': commission_percentage,
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
                    amount_paid_cents = 999  # Valor padrão (9.99€)
                    commission_cents = int(amount_paid_cents * (commission_percentage / 100))
                    payment_info = {
                        'amount_paid_cents': amount_paid_cents,
                        'commission_cents': commission_cents,
                        'commission_percentage': commission_percentage,
                        'currency': 'eur',
                        'paid_at': ref.subscription_date.isoformat(),
                        'subscription_status': referred_user.subscription_status if referred_user else 'active',
                        'plan_name': None,
                        'plan_interval': None
                    }
        
        referrals_data.append(schemas.AffiliateReferralResponse(
            id=ref.id,
            referred_user_email=referred_user.email if referred_user else 'N/A',
            referred_user_full_name=referred_user.full_name if referred_user else None,
            has_subscribed=ref.has_subscribed,
            subscription_date=ref.subscription_date,
            created_at=ref.created_at,
            payment_info=payment_info
        ))
    
    # Comissões mensais
    commissions = db.query(models.AffiliateCommission).filter(
        models.AffiliateCommission.affiliate_id == current_user.id
    ).order_by(models.AffiliateCommission.month.desc()).all()
    
    monthly_commissions = []
    for comm in commissions:
        monthly_commissions.append({
            'month': comm.month.strftime('%Y-%m'),
            'revenue_cents': comm.total_revenue_cents,
            'commission_cents': comm.commission_amount_cents,
            'conversions': comm.conversions_count,
            'is_paid': comm.is_paid
        })
    
    # Calcular faturamento semanal (últimas 8 semanas)
    weekly_data = defaultdict(lambda: {'revenue_cents': 0, 'commission_cents': 0})
    
    # Buscar referrals que pagaram
    paid_referrals = [ref for ref in referrals_data if ref.payment_info and ref.payment_info.get('amount_paid_cents', 0) > 0]
    
    for ref in paid_referrals:
        payment_info = ref.payment_info
        if payment_info and payment_info.get('paid_at'):
            try:
                paid_at_str = payment_info['paid_at']
                # Remover timezone se presente
                if 'Z' in paid_at_str:
                    paid_at_str = paid_at_str.replace('Z', '+00:00')
                elif '+' in paid_at_str or paid_at_str.endswith('+00:00'):
                    pass  # Já tem timezone
                else:
                    paid_at_str = paid_at_str + '+00:00'
                
                paid_date = datetime.fromisoformat(paid_at_str)
                if paid_date.tzinfo:
                    paid_date = paid_date.replace(tzinfo=None)
                
                # Calcular semana (ano-semana ISO)
                year, week_num, weekday = paid_date.isocalendar()
                week_key = f"{year}-W{week_num:02d}"
                
                # Calcular início da semana (segunda-feira) para label
                # ISO weekday: 1=Monday, 7=Sunday
                days_since_monday = weekday - 1
                week_start = paid_date - timedelta(days=days_since_monday)
                week_label = week_start.strftime('%d/%m')
                
                amount_paid = payment_info.get('amount_paid_cents', 0)
                commission = payment_info.get('commission_cents', 0)
                
                if week_key not in weekly_data:
                    weekly_data[week_key] = {'revenue_cents': 0, 'commission_cents': 0, 'week_label': week_label}
                
                weekly_data[week_key]['revenue_cents'] += amount_paid
                weekly_data[week_key]['commission_cents'] += commission
            except Exception as e:
                logger.warning(f'Erro ao processar data de pagamento para referência {ref.id}: {str(e)}')
    
    # Ordenar por semana e pegar últimas 8 semanas
    weekly_revenue = []
    sorted_weeks = sorted(weekly_data.keys(), reverse=True)[:8]
    for week_key in reversed(sorted_weeks):  # Reverter para mostrar do mais antigo ao mais recente
        data = weekly_data[week_key]
        weekly_revenue.append({
            'week': week_key,
            'week_label': data.get('week_label', week_key),
            'revenue_cents': int(data['revenue_cents']),
            'commission_cents': int(data['commission_cents'])
        })
    
    return schemas.AffiliateStats(
        total_referrals=total_referrals,
        total_conversions=total_conversions,
        conversion_rate=round(conversion_rate, 2),
        total_earnings_cents=int(total_earnings),
        pending_earnings_cents=int(pending_earnings),
        paid_earnings_cents=int(paid_earnings),
        referrals=referrals_data,
        monthly_commissions=monthly_commissions,
        weekly_revenue=weekly_revenue
    )


