from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, extract
from typing import List, Tuple
from uuid import UUID
from datetime import datetime, timedelta, date, timezone
from collections import defaultdict
import csv
import io
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


def _plan_ids():
    """Price IDs dos planos (via config para permitir override por env)."""
    return (
        settings.STRIPE_PRICE_BASIC_MONTHLY,
        settings.STRIPE_PRICE_PLUS,
        settings.STRIPE_PRICE_YEARLY,
    )

def check_user_has_affiliate_access(user: models.User, db: Session) -> Tuple[bool, str]:
    """
    Verifica se o utilizador tem direito a afiliados baseado no plano.
    
    Retorna: (has_access: bool, reason: str)
    
    Lógica:
    - Admin: sempre tem acesso
    - Plano 3 meses: Tem acesso
    - Plano 1 ano: Tem acesso
    - Plano básico (1 mês): Precisa de 3 meses consecutivos pagos
    """
    if user.is_admin:
        return (True, 'Admin')
    if not settings.STRIPE_API_KEY or not user.stripe_customer_id:
        return (False, 'Sem subscrição ativa')
    
    try:
        # Buscar subscrição ativa
        if not user.stripe_subscription_id:
            return (False, 'Sem subscrição ativa')
        
        subscription = stripe.Subscription.retrieve(user.stripe_subscription_id)
        
        if subscription.status not in ['active', 'trialing']:
            return (False, 'Subscrição não está ativa')
        
        # Verificar qual o plano atual (compatível com StripeObject e dict)
        items = getattr(subscription, 'items', None)
        if callable(items):
            if hasattr(subscription, 'get'):
                items = subscription.get('items')
            else:
                items = None
        if items and hasattr(items, 'data'):
            items_data = items.data
        elif isinstance(items, dict):
            items_data = items.get('data')
        else:
            items_data = None
        
        if not items_data:
            return (False, 'Subscrição sem itens')
        
        first_item = items_data[0]
        price = getattr(first_item, 'price', None)
        if isinstance(first_item, dict):
            price = first_item.get('price')
        current_price_id = getattr(price, 'id', None) if price else None
        if isinstance(price, dict):
            current_price_id = price.get('id')
        if not current_price_id:
            return (False, 'Plano inválido')
        
        plan_basic, plan_plus, plan_yearly = _plan_ids()
        # Planos que dão acesso direto a afiliados
        if current_price_id in [plan_plus, plan_yearly]:
            return (True, 'Plano com acesso a afiliados')
        
        # Plano básico (1 mês) - verificar se tem 3 meses consecutivos pagos
        if current_price_id == plan_basic:
            # Buscar todas as invoices pagas do customer (expandir subscription para metadata original_price_id)
            invoices = stripe.Invoice.list(
                customer=user.stripe_customer_id,
                status='paid',
                limit=100,
                expand=['data.subscription']
            )

            # Filtrar apenas invoices do plano básico: price_id nas linhas OU metadata.original_price_id na subscrição
            # (checkout com taxa Stripe usa price_data dinâmico; o plano fica em subscription.metadata.original_price_id)
            basic_invoices = []
            for inv in invoices.data:
                is_basic = False
                for line_item in inv.lines.data:
                    if hasattr(line_item, 'price') and line_item.price and getattr(line_item.price, 'id', None) == plan_basic:
                        is_basic = True
                        break
                if not is_basic and getattr(inv, 'subscription', None):
                    sub = inv.subscription
                    meta = getattr(sub, 'metadata', None) or {}
                    if isinstance(meta, dict) and meta.get('original_price_id') == plan_basic:
                        is_basic = True
                if is_basic:
                    basic_invoices.append(inv)

            if len(basic_invoices) < 3:
                months_paid = len(basic_invoices)
                return (False, f'Plano básico: precisas de 3 meses consecutivos pagos. Tens {months_paid} mês(es) pago(s).')
            
            # Extrair os meses de cada invoice (usar period_start para determinar o mês)
            invoice_months = set()
            for inv in basic_invoices:
                if hasattr(inv, 'period_start') and inv.period_start:
                    inv_date = datetime.fromtimestamp(inv.period_start, tz=timezone.utc)
                    invoice_months.add((inv_date.year, inv_date.month))
                elif hasattr(inv, 'created') and inv.created:
                    inv_date = datetime.fromtimestamp(inv.created, tz=timezone.utc)
                    invoice_months.add((inv_date.year, inv_date.month))
            
            if len(invoice_months) < 3:
                return (False, f'Plano básico: precisas de 3 meses consecutivos pagos. Tens {len(invoice_months)} mês(es) diferente(s) pago(s).')
            
            # Ordenar meses
            sorted_months = sorted(list(invoice_months))
            
            # Verificar se há 3 meses consecutivos em qualquer lugar do histórico
            consecutive_count = 1
            max_consecutive = 1
            
            for i in range(len(sorted_months) - 1):
                year1, month1 = sorted_months[i]
                year2, month2 = sorted_months[i + 1]
                
                # Calcular próximo mês esperado
                next_month = month1 + 1
                next_year = year1
                if next_month > 12:
                    next_month = 1
                    next_year += 1
                
                # Se o próximo mês é consecutivo, incrementar contador
                if (year2, month2) == (next_year, next_month):
                    consecutive_count += 1
                    max_consecutive = max(max_consecutive, consecutive_count)
                else:
                    consecutive_count = 1
            
            if max_consecutive >= 3:
                return (True, 'Plano básico com 3 meses consecutivos pagos')
            else:
                return (False, f'Plano básico: precisas de 3 meses consecutivos pagos. Tens {max_consecutive} mês(es) consecutivo(s) pago(s).')
        
        # Plano desconhecido
        return (False, 'Plano não reconhecido')
        
    except stripe.error.StripeError as e:
        logger.error(f'Erro ao verificar acesso a afiliados: {str(e)}')
        return (False, f'Erro ao verificar subscrição: {str(e)}')
    except Exception as e:
        logger.error(f'Erro inesperado ao verificar acesso a afiliados: {str(e)}', exc_info=True)
        return (False, 'Erro ao verificar acesso')

def check_stripe_connect_status(user: models.User, db: Session) -> bool:
    """Verifica o status do Stripe Connect em tempo real e atualiza os campos locais"""
    from ..core.config import settings
    if not user.stripe_connect_account_id or not settings.STRIPE_API_KEY:
        # Se não tem account_id, usar status local
        return (
            user.stripe_connect_account_id is not None and
            user.stripe_connect_onboarding_completed and
            user.stripe_connect_account_status == 'active'
        )
    
    try:
        account = stripe.Account.retrieve(user.stripe_connect_account_id)
        details_submitted = account.get('details_submitted', False)
        charges_enabled = account.get('charges_enabled', False)
        payouts_enabled = account.get('payouts_enabled', False)
        
        # Atualizar campos locais com status real do Stripe
        if details_submitted and charges_enabled:
            user.stripe_connect_onboarding_completed = True
            user.stripe_connect_account_status = 'active' if payouts_enabled else 'pending'
            user.affiliate_payout_enabled = payouts_enabled
            # Considerar configurado se onboarding está completo e charges estão ativos
            db.commit()
            return True
        else:
            user.stripe_connect_onboarding_completed = False
            user.stripe_connect_account_status = 'pending'
            user.affiliate_payout_enabled = False
            db.commit()
            return False
    except stripe.error.StripeError as e:
        logger.warning(f"Erro ao verificar status Stripe Connect: {str(e)}. Usando status local.")
        # Em caso de erro, usar status local
        return (
            user.stripe_connect_onboarding_completed and
            user.stripe_connect_account_status == 'active'
        )

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
    logger.info(f"📊 GET /affiliate/status - User: {current_user.email} (ID: {current_user.id})")
    from ..core.config import settings
    
    if not current_user.is_affiliate:
        logger.info(f"   → User não é afiliado")
        return schemas.AffiliateResponse(
            is_affiliate=False,
            affiliate_code=None,
            affiliate_link=None,
            total_referrals=0,
            total_conversions=0,
            total_earnings_cents=0,
            pending_earnings_cents=0,
            stripe_connect_configured=False,
            stripe_connect_account_id=None
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
    
    # Verificar se tem Stripe Connect configurado e ativo (em tempo real)
    stripe_connect_configured = check_stripe_connect_status(current_user, db)
    
    logger.info(f"   → Status: is_affiliate={current_user.is_affiliate}, "
                f"stripe_connect_configured={stripe_connect_configured}, "
                f"referrals={total_referrals}, conversions={total_conversions}")
    
    return schemas.AffiliateResponse(
        is_affiliate=current_user.is_affiliate,
        affiliate_code=current_user.affiliate_code,
        affiliate_link=affiliate_link,
        total_referrals=total_referrals,
        total_conversions=total_conversions,
        total_earnings_cents=int(total_earnings),
        pending_earnings_cents=int(pending_earnings),
        stripe_connect_configured=stripe_connect_configured,
        stripe_connect_account_id=current_user.stripe_connect_account_id
    )

@router.post('/request', response_model=schemas.AffiliateResponse)
async def request_affiliate_status(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    """Solicita para se tornar afiliado - aprova baseado no plano"""
    logger.info(f"📝 POST /affiliate/request - User: {current_user.email} (ID: {current_user.id})")
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
        
        # Verificar Stripe Connect (em tempo real)
        stripe_connect_configured = check_stripe_connect_status(current_user, db)
        
        return schemas.AffiliateResponse(
            is_affiliate=True,
            affiliate_code=current_user.affiliate_code,
            affiliate_link=affiliate_link,
            total_referrals=total_referrals,
            total_conversions=total_conversions,
            total_earnings_cents=int(total_earnings),
            pending_earnings_cents=int(pending_earnings),
            stripe_connect_configured=stripe_connect_configured,
            stripe_connect_account_id=current_user.stripe_connect_account_id
        )
    
    # Verificar se tem direito a afiliados baseado no plano
    has_access, reason = check_user_has_affiliate_access(current_user, db)
    
    if not has_access:
        raise HTTPException(
            status_code=400,
            detail=reason
        )
    
    # Se tem acesso, aprovar automaticamente
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
        details=f'Utilizador {current_user.email} aprovado automaticamente como afiliado ({reason})',
        request=request
    )
    
    # Retornar status atualizado
    affiliate_link = f"{settings.FRONTEND_URL}/auth/register?ref={current_user.affiliate_code}"
    
    # Verificar Stripe Connect (em tempo real)
    stripe_connect_configured = check_stripe_connect_status(current_user, db)
    
    return schemas.AffiliateResponse(
        is_affiliate=True,
        affiliate_code=current_user.affiliate_code,
        affiliate_link=affiliate_link,
        total_referrals=0,
        total_conversions=0,
        total_earnings_cents=0,
        pending_earnings_cents=0,
        stripe_connect_configured=stripe_connect_configured,
        stripe_connect_account_id=current_user.stripe_connect_account_id
    )

@router.get('/stats', response_model=schemas.AffiliateStats)
async def get_affiliate_stats(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna estatísticas detalhadas do afiliado"""
    logger.info(f"📈 GET /affiliate/stats - User: {current_user.email} (ID: {current_user.id})")
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
    
    # Comissão por plano: Plus 20%, Pro 25% (editável pelo admin)
    plus_s = db.query(models.SystemSetting).filter(models.SystemSetting.key == 'affiliate_commission_percentage_plus').first()
    pro_s = db.query(models.SystemSetting).filter(models.SystemSetting.key == 'affiliate_commission_percentage_pro').first()
    commission_plus = float(plus_s.value) if plus_s and plus_s.value else 20.0
    commission_pro = float(pro_s.value) if pro_s and pro_s.value else 25.0
    commission_percentage = commission_plus  # fallback para payment_info legado
    
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
                    # Acesso seguro a subscription.items.data (pode ser vazio ou inexistente)
                    items_obj = getattr(subscription, 'items', None)
                    items_data = (getattr(items_obj, 'data', None) or []) if items_obj else []
                    plan_info = items_data[0].price if len(items_data) > 0 else None

                    # Buscar última invoice paga (expandir charge para valor líquido sem reembolsos)
                    invoices = stripe.Invoice.list(
                        subscription=subscription.id,
                        status='paid',
                        limit=1,
                        expand=['data.charge']
                    )
                    if invoices.data:
                        invoice = invoices.data[0]
                        # Valor líquido (excluir reembolsos) para não mostrar receita já devolvida
                        amount_paid_cents = getattr(invoice, 'amount_paid', 0) or 0
                        charge = getattr(invoice, 'charge', None)
                        if charge:
                            if isinstance(charge, str):
                                try:
                                    charge = stripe.Charge.retrieve(charge)
                                except Exception:
                                    pass
                            if charge:
                                amount_refunded = getattr(charge, 'amount_refunded', 0) or 0
                                amount_paid_cents = max(0, amount_paid_cents - amount_refunded)
                        commission_cents = int(amount_paid_cents * (commission_percentage / 100))
                        payment_info = {
                            'amount_paid_cents': amount_paid_cents,
                            'commission_cents': commission_cents,
                            'commission_percentage': commission_percentage,
                            'currency': invoice.currency,
                            'paid_at': datetime.fromtimestamp(invoice.created, tz=timezone.utc).isoformat() if invoice.created else None,
                            'subscription_status': subscription.status,
                            'plan_name': plan_info.nickname if plan_info and getattr(plan_info, 'nickname', None) else (getattr(plan_info, 'product', None) if plan_info else None),
                            'plan_interval': getattr(getattr(plan_info, 'recurring', None), 'interval', None) if plan_info else None
                        }
                    else:
                        # Se não houver invoice paga, usar informações da subscription
                        amount_paid_cents = getattr(plan_info, 'unit_amount', 999) if plan_info else 999
                        commission_cents = int(amount_paid_cents * (commission_percentage / 100))
                        payment_info = {
                            'amount_paid_cents': amount_paid_cents,
                            'commission_cents': commission_cents,
                            'commission_percentage': commission_percentage,
                            'currency': getattr(plan_info, 'currency', 'eur') if plan_info else 'eur',
                            'paid_at': ref.subscription_date.isoformat() if ref.subscription_date else None,
                            'subscription_status': subscription.status,
                            'plan_name': plan_info.nickname if plan_info and getattr(plan_info, 'nickname', None) else (getattr(plan_info, 'product', None) if plan_info else None),
                            'plan_interval': getattr(getattr(plan_info, 'recurring', None), 'interval', None) if plan_info else None
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
            'is_paid': comm.is_paid,
            'paid_at': comm.paid_at.isoformat() if comm.paid_at else None,
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
        commission_plus_percent=commission_plus,
        commission_pro_percent=commission_pro,
        referrals=referrals_data,
        monthly_commissions=monthly_commissions,
        weekly_revenue=weekly_revenue
    )


@router.get('/export/csv')
async def export_affiliate_csv(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Exporta referências e comissões mensais em CSV (idem aos dados da dashboard, sem chamadas Stripe extra)."""
    if not current_user.is_affiliate:
        raise HTTPException(status_code=403, detail='Não és afiliado.')
    referrals = db.query(models.AffiliateReferral).filter(
        models.AffiliateReferral.referrer_id == current_user.id
    ).order_by(models.AffiliateReferral.created_at.desc()).all()
    commissions = db.query(models.AffiliateCommission).filter(
        models.AffiliateCommission.affiliate_id == current_user.id
    ).order_by(models.AffiliateCommission.month.desc()).all()
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(['email', 'nome', 'subscrito', 'data_subscricao', 'data_registo'])
    for ref in referrals:
        u = db.query(models.User).filter(models.User.id == ref.referred_user_id).first()
        email = u.email if u else 'N/A'
        name = (u.full_name or '').strip() or ''
        sub = 'Sim' if ref.has_subscribed else 'Não'
        sub_date = ref.subscription_date.strftime('%Y-%m-%d') if ref.subscription_date else ''
        created = ref.created_at.strftime('%Y-%m-%d %H:%M') if ref.created_at else ''
        w.writerow([email, name, sub, sub_date, created])
    buf.write('\n')
    w.writerow(['mes', 'receita_eur', 'comissao_eur', 'conversoes', 'pago', 'data_pagamento'])
    for c in commissions:
        rev_eur = f'{c.total_revenue_cents / 100:.2f}'
        com_eur = f'{c.commission_amount_cents / 100:.2f}'
        pago = 'Sim' if c.is_paid else 'Não'
        paid_at = c.paid_at.strftime('%Y-%m-%d') if c.paid_at else ''
        w.writerow([c.month.strftime('%Y-%m'), rev_eur, com_eur, c.conversions_count, pago, paid_at])
    buf.seek(0)
    filename = f"afiliado_{current_user.affiliate_code or 'export'}_{date.today().isoformat()}.csv"
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type='text/csv; charset=utf-8',
        headers={'Content-Disposition': f'attachment; filename="{filename}"'}
    )


# =====================================================
# STRIPE CONNECT ENDPOINTS
# =====================================================

@router.get('/stripe-connect/onboard')
async def create_stripe_connect_onboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Cria conta Stripe Connect Express e retorna link de onboarding"""
    if not current_user.is_affiliate:
        raise HTTPException(
            status_code=403,
            detail='Não és afiliado.'
        )
    
    if not settings.STRIPE_API_KEY:
        raise HTTPException(
            status_code=500,
            detail='Stripe não está configurado.'
        )
    
    try:
        # Se já tem conta, retornar link de onboarding existente
        if current_user.stripe_connect_account_id:
            account = stripe.Account.retrieve(current_user.stripe_connect_account_id)
            
            # Criar link de onboarding (pode ser usado para completar ou atualizar)
            account_link = stripe.AccountLink.create(
                account=current_user.stripe_connect_account_id,
                refresh_url=f"{settings.FRONTEND_URL}/affiliate/stripe-connect?refresh=true",
                return_url=f"{settings.FRONTEND_URL}/affiliate/stripe-connect?success=true",
                type='account_onboarding',
            )
            
            return {
                'onboard_url': account_link.url,
                'account_id': current_user.stripe_connect_account_id,
                'status': current_user.stripe_connect_account_status
            }
        
        # Criar nova conta Express
        account = stripe.Account.create(
            type='express',
            country='PT',  # Pode ser configurável
            email=current_user.email,
            capabilities={
                'card_payments': {'requested': True},
                'transfers': {'requested': True},
            },
            metadata={
                'user_id': str(current_user.id),
                'email': current_user.email
            }
        )
        
        # Guardar account_id
        current_user.stripe_connect_account_id = account.id
        current_user.stripe_connect_account_status = 'pending'
        db.commit()
        
        # Criar link de onboarding
        account_link = stripe.AccountLink.create(
            account=account.id,
            refresh_url=f"{settings.FRONTEND_URL}/affiliate/stripe-connect?refresh=true",
            return_url=f"{settings.FRONTEND_URL}/affiliate/stripe-connect?success=true",
            type='account_onboarding',
        )
        
        logger.info(f'Stripe Connect account criada para afiliado {current_user.email}: {account.id}')
        
        return {
            'onboard_url': account_link.url,
            'account_id': account.id,
            'status': 'pending'
        }
        
    except stripe.error.StripeError as e:
        logger.error(f'Erro ao criar conta Stripe Connect: {str(e)}')
        raise HTTPException(
            status_code=400,
            detail=f'Erro ao criar conta Stripe: {str(e)}'
        )
    except Exception as e:
        logger.error(f'Erro inesperado ao criar conta Stripe Connect: {str(e)}', exc_info=True)
        raise HTTPException(
            status_code=500,
            detail='Erro inesperado ao criar conta Stripe Connect.'
        )


@router.get('/stripe-connect/status')
async def get_stripe_connect_status(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna status da conta Stripe Connect do afiliado"""
    logger.info(f"🔗 GET /affiliate/stripe-connect/status - User: {current_user.email} (ID: {current_user.id})")
    if not current_user.is_affiliate:
        raise HTTPException(
            status_code=403,
            detail='Não és afiliado.'
        )
    
    if not current_user.stripe_connect_account_id:
        return {
            'connected': False,
            'status': None,
            'onboarding_completed': False,
            'payout_enabled': False
        }
    
    try:
        if settings.STRIPE_API_KEY:
            account = stripe.Account.retrieve(current_user.stripe_connect_account_id)
            
            # Atualizar status local se necessário
            details_submitted = account.get('details_submitted', False)
            charges_enabled = account.get('charges_enabled', False)
            payouts_enabled = account.get('payouts_enabled', False)
            
            if details_submitted and charges_enabled:
                current_user.stripe_connect_onboarding_completed = True
                current_user.stripe_connect_account_status = 'active' if payouts_enabled else 'pending'
                current_user.affiliate_payout_enabled = payouts_enabled
            else:
                current_user.stripe_connect_onboarding_completed = False
                current_user.stripe_connect_account_status = 'pending'
                current_user.affiliate_payout_enabled = False
            
            db.commit()
            
            return {
                'connected': True,
                'account_id': current_user.stripe_connect_account_id,
                'status': current_user.stripe_connect_account_status,
                'onboarding_completed': current_user.stripe_connect_onboarding_completed,
                'payout_enabled': current_user.affiliate_payout_enabled,
                'details_submitted': details_submitted,
                'charges_enabled': charges_enabled,
                'payouts_enabled': payouts_enabled
            }
        else:
            # Se Stripe não está configurado, retornar status local
            return {
                'connected': True,
                'account_id': current_user.stripe_connect_account_id,
                'status': current_user.stripe_connect_account_status,
                'onboarding_completed': current_user.stripe_connect_onboarding_completed,
                'payout_enabled': current_user.affiliate_payout_enabled
            }
            
    except stripe.error.StripeError as e:
        logger.error(f'Erro ao buscar status da conta Stripe Connect: {str(e)}')
        # Retornar status local em caso de erro (sem expor detalhes internos do Stripe)
        return {
            'connected': True,
            'account_id': current_user.stripe_connect_account_id,
            'status': current_user.stripe_connect_account_status,
            'onboarding_completed': current_user.stripe_connect_onboarding_completed,
            'payout_enabled': current_user.affiliate_payout_enabled,
            'error': 'Erro temporário ao verificar conta Stripe. Tenta novamente.'
        }
    except Exception as e:
        logger.error(f'Erro inesperado ao buscar status: {str(e)}', exc_info=True)
        raise HTTPException(
            status_code=500,
            detail='Erro inesperado ao buscar status da conta Stripe Connect.'
        )


@router.get('/stripe-connect/dashboard')
async def get_stripe_connect_dashboard(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Retorna link do dashboard Stripe do afiliado"""
    if not current_user.is_affiliate:
        raise HTTPException(
            status_code=403,
            detail='Não és afiliado.'
        )
    
    if not current_user.stripe_connect_account_id:
        raise HTTPException(
            status_code=400,
            detail='Conta Stripe Connect não configurada. Completa o onboarding primeiro.'
        )
    
    if not settings.STRIPE_API_KEY:
        raise HTTPException(
            status_code=500,
            detail='Stripe não está configurado.'
        )
    
    try:
        login_link = stripe.Account.create_login_link(
            current_user.stripe_connect_account_id,
            redirect_url=f"{settings.FRONTEND_URL}/affiliate"
        )
        url = getattr(login_link, 'url', None)
        if not url:
            raise HTTPException(status_code=500, detail='Stripe não devolveu o link do dashboard.')
        return {'dashboard_url': url}
        
    except stripe.error.StripeError as e:
        logger.error(f'Erro ao criar login link: {str(e)}')
        raise HTTPException(
            status_code=400,
            detail=f'Erro ao aceder ao dashboard: {str(e)}'
        )
    except Exception as e:
        logger.error(f'Erro inesperado: {str(e)}', exc_info=True)
        raise HTTPException(
            status_code=500,
            detail='Erro inesperado ao aceder ao dashboard Stripe.'
        )


@router.post('/stripe-connect/disconnect')
async def disconnect_stripe_connect(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    """Desliga a conta Stripe Connect do afiliado. Permite associar outra conta depois."""
    if not current_user.is_affiliate:
        raise HTTPException(
            status_code=403,
            detail='Não és afiliado.'
        )
    if not current_user.stripe_connect_account_id:
        return {'ok': True, 'message': 'Nenhuma conta estava ligada.'}

    current_user.stripe_connect_account_id = None
    current_user.stripe_connect_onboarding_completed = False
    current_user.stripe_connect_account_status = None
    current_user.affiliate_payout_enabled = False
    db.commit()

    logger.info(f'Stripe Connect desligado para afiliado {current_user.email}')
    return {'ok': True, 'message': 'Conta Stripe desligada. Podes configurar outra conta quando quiseres.'}
