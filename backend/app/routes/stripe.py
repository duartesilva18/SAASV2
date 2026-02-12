from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
import stripe
from datetime import datetime, timezone, timedelta
from ..core.config import settings
from ..core.dependencies import get_db
from ..core.affiliate_commission import get_commission_percentage_for_price_id
from ..models import database as models
from .auth import get_current_user
import logging
from sqlalchemy import and_

router = APIRouter(prefix='/stripe', tags=['stripe'])
stripe.api_key = settings.STRIPE_API_KEY
STRIPE_WEBHOOK_SECRET = settings.STRIPE_WEBHOOK_SECRET

logger = logging.getLogger(__name__)

# Taxa Stripe UE: 1.5% + 0.25€. Para receber base_cents, cobrar (base_cents + 25) / 0.985.
def _charge_amount_with_stripe_fee(base_cents: int) -> int:
    """Valor em cêntimos a cobrar ao cliente para que, após taxa Stripe (1.5% + 0.25€), recebas base_cents."""
    if base_cents <= 0:
        return base_cents
    import math
    return int(math.ceil((base_cents + 25) / 0.985))

@router.post('/create-checkout-session')
async def create_checkout_session(price_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        logger.info(f'[Checkout] Início: user_id={current_user.id} email={current_user.email} referrer_id={current_user.referrer_id} price_id={price_id}')
        customer_id = current_user.stripe_customer_id
        
        if not customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                metadata={'user_id': str(current_user.id)}
            )
            customer_id = customer.id
            current_user.stripe_customer_id = customer_id
            db.commit()
            logger.info(f'[Checkout] Cliente Stripe criado: {customer_id}')
        
        # Buscar preço para calcular total
        price = stripe.Price.retrieve(price_id)
        total_amount_cents = getattr(price, 'unit_amount', None) or 0  # Valor total em cêntimos (evitar None)
        if total_amount_cents < 0:
            total_amount_cents = 0
        logger.info(f'[Checkout] Preço: price_id={price_id} total_amount_cents={total_amount_cents}')
        
        # Verificar se cliente tem referrer (por user.referrer_id ou por AffiliateReferral) e se referrer tem Stripe Connect ativo
        application_fee_amount = None
        transfer_data = None
        referrer_id = None
        referrer = None
        commission_percentage = 0.0

        if current_user.referrer_id:
            referrer = db.query(models.User).filter(models.User.id == current_user.referrer_id).first()
        if not referrer:
            # Fallback: utilizador pode ter sido referido mas user.referrer_id não estar definido (ex: bug antigo)
            ref_row = db.query(models.AffiliateReferral).filter(
                models.AffiliateReferral.referred_user_id == current_user.id
            ).first()
            if ref_row:
                referrer = db.query(models.User).filter(models.User.id == ref_row.referrer_id).first()
                if referrer:
                    logger.info(f'[Checkout] Referrer obtido via AffiliateReferral (user {current_user.email} não tinha referrer_id): {referrer.email}')
                    # Corrigir user.referrer_id para futuros checkouts e lógica geral
                    current_user.referrer_id = referrer.id
                    db.commit()

        if referrer:
            logger.info(f'[Checkout] Referrer encontrado: referrer_id={referrer.id} email={referrer.email} is_affiliate={referrer.is_affiliate} stripe_connect_account_id={referrer.stripe_connect_account_id or "não definido"}')
            
            if referrer.is_affiliate and referrer.stripe_connect_account_id:
                # Verificar se conta está ativa (verificar em tempo real com Stripe)
                # Considerar ativa se onboarding está completo e charges estão habilitados
                # (payouts pode demorar a ativar, mas a conta já está funcional)
                try:
                    if settings.STRIPE_API_KEY:
                        account = stripe.Account.retrieve(referrer.stripe_connect_account_id)
                        details_submitted = account.get('details_submitted', False)
                        charges_enabled = account.get('charges_enabled', False)
                        payouts_enabled = account.get('payouts_enabled', False)
                        is_connect_active = details_submitted and charges_enabled
                        logger.info(
                            f'[Checkout] Stripe Connect afiliado {referrer.email} (account_id={referrer.stripe_connect_account_id}): '
                            f'details_submitted={details_submitted}, charges_enabled={charges_enabled}, payouts_enabled={payouts_enabled}, '
                            f'is_connect_active={is_connect_active}'
                        )
                        if not is_connect_active:
                            if not details_submitted:
                                logger.warning(f'[Checkout] Afiliado {referrer.email}: onboarding incompleto (details_submitted=False). Completar em Stripe Connect.')
                            if not charges_enabled:
                                logger.warning(f'[Checkout] Afiliado {referrer.email}: conta sem charges_enabled. Stripe ainda não ativou a conta para receber.')
                    else:
                        # Se Stripe não está configurado, usar status local
                        is_connect_active = referrer.stripe_connect_onboarding_completed
                        logger.info(f'[Checkout] Stripe API não configurada; usando status local do afiliado: is_connect_active={is_connect_active}')
                except Exception as e:
                    logger.warning(f'[Checkout] Erro ao verificar Stripe Connect do afiliado {referrer.email}: {str(e)}. Usando status local.')
                    is_connect_active = referrer.stripe_connect_onboarding_completed
                
                if is_connect_active:
                    # Comissão por plano: Plus 20%, Pro 25% (editável pelo admin). Basic = 0%. Outros planos pagos = 25%.
                    commission_percentage = get_commission_percentage_for_price_id(price_id, db)
                    logger.info(f'[Checkout] Comissão para price_id={price_id}: {commission_percentage}%')
                    
                    # Calcular comissão só se plano pago (Plus/Pro)
                    application_fee_amount = int(total_amount_cents * (commission_percentage / 100)) if commission_percentage > 0 else None
                    # Só aplicar divisão se houver valor a transferir (mín. 1 cêntimo) e total válido
                    if application_fee_amount and application_fee_amount >= 1 and total_amount_cents >= 1:
                        referrer_id = str(referrer.id)
                        transfer_data = {
                            'destination': referrer.stripe_connect_account_id,
                        }
                        logger.info(
                            f'[Checkout] ✅ Divisão aplicada: {application_fee_amount} cêntimos ({commission_percentage}%) → afiliado {referrer.email} '
                            f'(destination={referrer.stripe_connect_account_id})'
                        )
                    else:
                        application_fee_amount = None
                        transfer_data = None
                        if commission_percentage <= 0:
                            logger.warning(f'[Checkout] Divisão NÃO aplicada: comissão 0% para price_id={price_id}. Afiliado {referrer.email} não recebe comissão desta venda.')
                        else:
                            logger.warning(f'[Checkout] Divisão NÃO aplicada: application_fee_amount inválido (total={total_amount_cents}, pct={commission_percentage})')
                else:
                    logger.warning(
                        f'[Checkout] Divisão NÃO aplicada: conta Connect do afiliado {referrer.email} não está ativa. '
                        f'O afiliado deve concluir o onboarding no Stripe (dados + conta bancária) para receber comissões.'
                    )
            else:
                if not referrer.is_affiliate:
                    logger.warning(f'[Checkout] Divisão NÃO aplicada: utilizador {referrer.email} não é afiliado (is_affiliate=False).')
                elif not referrer.stripe_connect_account_id:
                    logger.warning(f'[Checkout] Divisão NÃO aplicada: afiliado {referrer.email} não tem Stripe Connect ligado. Ligar conta em Afiliados.')
        else:
            if not current_user.referrer_id:
                ref_exists = db.query(models.AffiliateReferral).filter(
                    models.AffiliateReferral.referred_user_id == current_user.id
                ).first()
                if ref_exists:
                    logger.warning(f'[Checkout] Divisão NÃO aplicada: utilizador {current_user.email} tem referência em affiliate_referrals mas referrer não encontrado.')
                else:
                    logger.info(f'[Checkout] Sem afiliado: utilizador {current_user.email} não foi referido (sem referrer_id).')
        
        # Criar checkout session
        # IMPORTANTE (Stripe): A primeira invoice é criada IMEDIATAMENTE quando a subscription é criada.
        # Invoices não são recalculadas depois de criadas — metadata pode mudar, o split financeiro não.
        # Por isso transfer_data e application_fee_percent TÊM de estar aqui no Session; não há "aplicar depois".
        subscription_data = {
            'metadata': {
                'user_id': str(current_user.id),
                'referrer_id': referrer_id if referrer_id else ''
            }
        }
        
        # Guardar price_id original e valor base em metadata para webhooks (comissão só sobre o base, não sobre taxa Stripe)
        subscription_data['metadata']['original_price_id'] = price_id
        subscription_data['metadata']['base_amount_cents'] = str(total_amount_cents)
        
        # Total cobrado ao cliente: com taxa Stripe (duas linhas) ou só o preço base (uma linha)
        total_charged_cents = _charge_amount_with_stripe_fee(total_amount_cents) if total_amount_cents >= 1 else total_amount_cents
        
        # Adicionar divisão automática se aplicável (Stripe Connect)
        # application_fee_percent = % que a PLATAFORMA fica; afiliado recebe (100 - application_fee_percent)%.
        # Afiliado NÃO ganha sobre a taxa Stripe: comissão só sobre o preço base (total_amount_cents).
        if application_fee_amount and transfer_data:
            if total_charged_cents > total_amount_cents and total_charged_cents >= 1:
                # Duas linhas: afiliado recebe commission_percentage% do BASE apenas
                # (100 - application_fee_percent)/100 * total_charged = total_amount * commission_percentage/100
                affiliate_share_percent = (total_amount_cents * commission_percentage) / total_charged_cents
                application_fee_percent = round(100 - affiliate_share_percent, 2)
            else:
                application_fee_percent = round(100 - commission_percentage, 2)
            # Evitar 0 ou 100 que o Stripe pode rejeitar
            if application_fee_percent <= 0:
                application_fee_percent = 0.01
            elif application_fee_percent >= 100:
                application_fee_percent = 99.99
            
            subscription_data['application_fee_percent'] = application_fee_percent
            subscription_data['transfer_data'] = transfer_data
            subscription_data['metadata']['commission_percentage'] = str(commission_percentage)
            subscription_data['metadata']['commission_amount_cents'] = str(application_fee_amount)
            logger.info(f'[Checkout] Session será criada COM divisão: application_fee_percent={application_fee_percent} (afiliado não ganha sobre taxa Stripe), destination={transfer_data.get("destination")}')
        else:
            logger.info(f'[Checkout] Session será criada SEM divisão (sem afiliado ou divisão não elegível). referrer_id={referrer_id or "vazio"}')
        
        # Duas linhas no checkout: plano (preço base) + taxa de processamento Stripe (cliente vê o breakdown)
        if total_amount_cents >= 1:
            fee_cents = total_charged_cents - total_amount_cents
            logger.info(f'[Checkout] Taxa Stripe repassada ao cliente: base={total_amount_cents} cêntimos, taxa={fee_cents} cêntimos, total={total_charged_cents} cêntimos')
            currency = getattr(price, 'currency', 'eur')
            recurring = getattr(price, 'recurring', None)
            if not recurring:
                recurring = {'interval': 'month'}
            interval = recurring.get('interval', 'month') if isinstance(recurring, dict) else getattr(recurring, 'interval', 'month')
            interval_count = recurring.get('interval_count', 1) if isinstance(recurring, dict) else getattr(recurring, 'interval_count', 1)
            product_name = 'Finly Pro'
            try:
                if getattr(price, 'product', None):
                    prod = stripe.Product.retrieve(price.product) if isinstance(price.product, str) else price.product
                    product_name = getattr(prod, 'name', product_name) or product_name
            except Exception:
                pass
            # Duas linhas: plano (preço base) + taxa de processamento Stripe (cliente vê o breakdown)
            line_items = [
                {
                    'quantity': 1,
                    'price_data': {
                        'currency': currency,
                        'unit_amount': total_amount_cents,
                        'product_data': {'name': product_name},
                        'recurring': {'interval': interval, 'interval_count': interval_count},
                    },
                },
                {
                    'quantity': 1,
                    'price_data': {
                        'currency': currency,
                        'unit_amount': fee_cents,
                        'product_data': {'name': 'Taxa de processamento (Stripe)'},
                        'recurring': {'interval': interval, 'interval_count': interval_count},
                    },
                },
            ]
        else:
            line_items = [{'price': price_id, 'quantity': 1}]
        
        session_params = {
            'customer': customer_id,
            'payment_method_types': ['card'],
            'line_items': line_items,
            'mode': 'subscription',
            'client_reference_id': str(current_user.id),
            'success_url': f"{settings.FRONTEND_URL}/dashboard?session_id={{CHECKOUT_SESSION_ID}}",
            'cancel_url': f"{settings.FRONTEND_URL}/pricing",
            'subscription_data': subscription_data
        }
        
        checkout_session = stripe.checkout.Session.create(**session_params)
        logger.info(f'[Checkout] Session criada: session_id={checkout_session.id} url_ok={bool(checkout_session.url)} divisão_afiliado={bool(transfer_data)}')
        return {'url': checkout_session.url}
    except Exception as e:
        logger.error(f'Erro Stripe Checkout: {str(e)}', exc_info=True)
        raise HTTPException(status_code=400, detail='Erro ao criar sessão de pagamento. Tenta novamente.')

def _get_connect_params_for_subscription(user: models.User, price_id: str, db: Session):
    """Retorna (transfer_data, application_fee_percent) para Subscription.modify quando o user tem afiliado com Connect ativo. Caso contrário (None, None)."""
    referrer = None
    if user.referrer_id:
        referrer = db.query(models.User).filter(models.User.id == user.referrer_id).first()
    if not referrer:
        ref_row = db.query(models.AffiliateReferral).filter(
            models.AffiliateReferral.referred_user_id == user.id
        ).first()
        if ref_row:
            referrer = db.query(models.User).filter(models.User.id == ref_row.referrer_id).first()
    if not referrer or not referrer.is_affiliate or not referrer.stripe_connect_account_id:
        return None, None
    try:
        if settings.STRIPE_API_KEY:
            account = stripe.Account.retrieve(referrer.stripe_connect_account_id)
            if not (account.get('details_submitted') and account.get('charges_enabled')):
                return None, None
    except Exception:
        return None, None
    commission_percentage = get_commission_percentage_for_price_id(price_id, db)
    if commission_percentage <= 0:
        return None, None
    application_fee_percent = round(100 - commission_percentage, 2)
    if application_fee_percent <= 0:
        application_fee_percent = 0.01
    elif application_fee_percent >= 100:
        application_fee_percent = 99.99
    transfer_data = {'destination': referrer.stripe_connect_account_id}
    return transfer_data, application_fee_percent


@router.post('/change-plan')
async def change_plan(price_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Altera o plano da subscrição ativa do utilizador para o novo price_id (upgrade/downgrade com proration)."""
    try:
        if not current_user.stripe_subscription_id:
            raise HTTPException(
                status_code=400,
                detail='Não tens uma subscrição ativa. Subscreve primeiro um plano em Planos ou Preços.'
            )
        # Admins têm sempre Pro; outros utilizadores precisam de subscrição ativa
        if not current_user.is_admin and current_user.subscription_status not in ('active', 'trialing', 'cancel_at_period_end'):
            raise HTTPException(
                status_code=400,
                detail='A tua subscrição não está ativa. Subscreve um plano para continuar.'
            )
        # Verificar que o novo preço existe
        stripe.Price.retrieve(price_id)
        sub = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
        items = sub.get('items', {}).get('data', [])
        if not items:
            raise HTTPException(status_code=400, detail='Subscrição sem itens. Contacta o suporte.')
        item_id = items[0]['id']
        # Manter divisão Connect em alterações de plano: repassar transfer_data e application_fee_percent
        transfer_data, application_fee_percent = _get_connect_params_for_subscription(current_user, price_id, db)
        modify_params = {'items': [{'id': item_id, 'price': price_id}]}
        if transfer_data is not None and application_fee_percent is not None:
            modify_params['transfer_data'] = transfer_data
            modify_params['application_fee_percent'] = application_fee_percent
            logger.info(f'[Change-plan] Com divisão Connect: application_fee_percent={application_fee_percent}, destination={transfer_data.get("destination")}')
        stripe.Subscription.modify(current_user.stripe_subscription_id, **modify_params)
        # Atualizar localmente para resposta imediata (o webhook subscription.updated também atualiza)
        sub_after = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
        current_user.subscription_status = sub_after.status
        db.commit()
        logger.info(f'Plano alterado para price_id={price_id} para user {current_user.email}')
        return {'success': True, 'message': 'Plano alterado.', 'subscription_status': sub_after.status}
    except stripe.error.StripeError as e:
        logger.error(f'Erro Stripe ao alterar plano: {str(e)}', exc_info=True)
        raise HTTPException(status_code=400, detail='Erro ao alterar plano. Tenta novamente.')
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Erro inesperado ao alterar plano: {str(e)}', exc_info=True)
        raise HTTPException(status_code=500, detail='Erro ao alterar plano.')

@router.post('/portal')
async def customer_portal(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        if not current_user.stripe_customer_id:
            raise HTTPException(
                status_code=400, 
                detail='Não tens um cliente Stripe associado. Subscreve primeiro um plano.'
            )
        
        # Verifica se o Stripe API key está configurado
        if not settings.STRIPE_API_KEY:
            raise HTTPException(
                status_code=500,
                detail='Stripe não está configurado no servidor.'
            )
            
        portal_session = stripe.billing_portal.Session.create(
            customer=current_user.stripe_customer_id,
            return_url=f"{settings.FRONTEND_URL}/settings"
        )
        return {'url': portal_session.url}
    except stripe.error.StripeError as e:
        logger.error(f'Erro Stripe Portal: {str(e)}')
        raise HTTPException(
            status_code=400, 
            detail='Erro ao aceder ao portal. Tenta novamente.'
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f'Erro inesperado no Portal: {str(e)}')
        raise HTTPException(
            status_code=500, 
            detail='Erro inesperado ao aceder ao portal de faturação.'
        )

@router.get('/verify-session/{session_id}')
async def verify_checkout_session(session_id: str, current_user: models.User = Depends(get_current_user)):
    """Verifica o status de uma sessão de checkout e atualiza a subscrição do utilizador"""
    try:
        # Buscar a sessão do Stripe
        session = stripe.checkout.Session.retrieve(session_id)
        
        # Verificar se a sessão pertence ao utilizador atual
        session_client_ref = getattr(session, 'client_reference_id', None)
        if session_client_ref and session_client_ref != str(current_user.id):
            raise HTTPException(status_code=403, detail='Esta sessão não pertence ao utilizador atual')
        
        # Se a sessão está completa e tem uma subscrição
        session_status = getattr(session, 'status', None)
        session_mode = getattr(session, 'mode', None)
        
        if session_status == 'complete' and session_mode == 'subscription':
            subscription_id = getattr(session, 'subscription', None)
            
            if subscription_id:
                # Buscar informações da subscrição
                subscription = stripe.Subscription.retrieve(subscription_id)
                subscription_status = subscription.status
                
                # Atualizar o utilizador na base de dados
                # Usar uma sessão de DB separada para garantir atualização
                from ..core.dependencies import SessionLocal
                from datetime import datetime, timezone as _tz
                db = SessionLocal()
                try:
                    user = db.query(models.User).filter(models.User.id == current_user.id).first()
                    if user:
                        user.stripe_subscription_id = subscription_id
                        user.subscription_status = subscription_status
                        session_customer = getattr(session, 'customer', None)
                        if not user.stripe_customer_id and session_customer:
                            user.stripe_customer_id = session_customer
                        
                        # Marcar conversão de afiliado se aplicável (garantir que está marcado)
                        if user.referrer_id and subscription_status in ['active', 'trialing']:
                            referral = db.query(models.AffiliateReferral).filter(
                                models.AffiliateReferral.referred_user_id == user.id
                            ).first()
                            if referral and not referral.has_subscribed:
                                referral.has_subscribed = True
                                from datetime import timezone as _tz
                                referral.subscription_date = datetime.now(_tz.utc)
                                logger.info(f'✅ Conversão de afiliado marcada: {referral.referrer_id} -> {user.email} (verify-session)')
                            elif referral:
                                logger.info(f'ℹ️ Referência já estava marcada como subscrita para {user.email}')
                            else:
                                logger.warning(f'⚠️ Usuário tem referrer_id ({user.referrer_id}) mas não foi encontrada referência em affiliate_referrals para {user.email}')
                        
                        db.commit()
                        db.refresh(user)
                        logger.info(f'Subscrição verificada e atualizada para {user.email}: {subscription_status}')
                except Exception as e:
                    db.rollback()
                    logger.error(f'Erro ao atualizar subscrição: {str(e)}')
                finally:
                    db.close()
                
                return {
                    'success': True,
                    'subscription_status': subscription_status,
                    'is_active': subscription_status in ['active', 'trialing']
                }
        
        return {
            'success': False,
            'message': 'A sessão ainda não está completa ou não tem subscrição'
        }
    except stripe.error.StripeError as e:
        logger.error(f'Erro Stripe ao verificar sessão: {str(e)}')
        raise HTTPException(status_code=400, detail='Erro ao verificar sessão. Tenta novamente.')
    except Exception as e:
        logger.error(f'Erro inesperado ao verificar sessão: {str(e)}')
        raise HTTPException(status_code=500, detail='Erro ao verificar sessão')

@router.get('/subscription-details')
async def get_subscription_details(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Retorna os detalhes da subscrição atual, incluindo o price_id. Admins e Pro concedido têm Pro ativo."""
    try:
        if current_user.has_effective_pro() and not current_user.stripe_subscription_id:
            return {
                'has_subscription': True,
                'price_id': None,
                'subscription_status': 'active',
                'cancel_at_period_end': False
            }
        if not current_user.stripe_subscription_id:
            return {
                'has_subscription': False,
                'price_id': None,
                'subscription_status': current_user.subscription_status
            }
        
        # Verificar se é subscrição de simulação/teste
        if current_user.stripe_customer_id and (current_user.stripe_customer_id.startswith('sim_') or current_user.stripe_customer_id.startswith('test_')):
            return {
                'has_subscription': True,
                'price_id': None,  # Simulação não tem price_id real
                'subscription_status': current_user.subscription_status
            }
        
        # Buscar subscrição do Stripe
        try:
            subscription = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
            price_id = None
            
            # Obter price_id da subscrição (ou original_price_id se checkout com taxa repassada)
            meta = subscription.get('metadata') or {}
            price_id = (meta.get('original_price_id') or '').strip() or None
            if not price_id:
                items = subscription.get('items', {})
                items_data = items.get('data', []) if isinstance(items, dict) else []
                if items_data:
                    price_id = items_data[0].get('price', {}).get('id')
            
            return {
                'has_subscription': True,
                'price_id': price_id,
                'subscription_status': subscription.status,
                'cancel_at_period_end': subscription.cancel_at_period_end
            }
        except stripe.error.InvalidRequestError as e:
            logger.warning(f'Subscrição não encontrada no Stripe: {str(e)}')
            return {
                'has_subscription': False,
                'price_id': None,
                'subscription_status': current_user.subscription_status
            }
    except Exception as e:
        logger.error(f'Erro ao buscar detalhes da subscrição: {str(e)}')
        raise HTTPException(status_code=500, detail='Erro ao buscar detalhes da subscrição')

def _subscription_within_refund_window(subscription) -> bool:
    """True se o período atual começou há menos de 7 dias (permite cancelamento imediato)."""
    period_start = subscription.get('current_period_start')
    if not period_start:
        return False
    start_dt = datetime.fromtimestamp(period_start, tz=timezone.utc)
    return (datetime.now(timezone.utc) - start_dt) < timedelta(days=7)


@router.post('/cancel-subscription')
async def cancel_subscription(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Cancela a subscrição: se passaram menos de 7 dias desde o início do período, cancela de imediato; senão, cancela só no fim do período (sem cobrança no próximo mês)."""
    try:
        logger.info(f'Tentativa de cancelar subscrição para {current_user.email}, subscription_id: {current_user.stripe_subscription_id}')
        
        if not current_user.stripe_subscription_id:
            logger.warning(f'Utilizador {current_user.email} tentou cancelar mas não tem subscription_id')
            raise HTTPException(status_code=400, detail='Não tens uma subscrição ativa para cancelar.')
        
        if current_user.subscription_status == 'canceled':
            logger.info(f'Subscrição já cancelada: {current_user.email}')
            return {
                'success': True,
                'message': 'Subscrição já está cancelada.',
                'subscription_status': 'canceled'
            }
        
        if current_user.subscription_status == 'cancel_at_period_end':
            return {
                'success': True,
                'message': 'A subscrição já está marcada para terminar no fim do período atual.',
                'subscription_status': 'cancel_at_period_end'
            }
        
        # Simulação/teste: cancelar de imediato
        if current_user.stripe_customer_id and (current_user.stripe_customer_id.startswith('sim_') or current_user.stripe_customer_id.startswith('test_')):
            logger.info(f'Subscrição de simulação - marcando como cancelada: {current_user.email}')
            current_user.subscription_status = 'canceled'
            db.commit()
            return {
                'success': True,
                'message': 'Subscrição cancelada com sucesso. O teu acesso Pro terminou.',
                'subscription_status': 'canceled'
            }
        
        subscription = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
        within_7_days = _subscription_within_refund_window(subscription)
        
        if within_7_days:
            # Menos de 7 dias: cancelar de imediato (acesso termina já)
            try:
                stripe.Subscription.delete(current_user.stripe_subscription_id)
                logger.info(f'Subscrição eliminada no Stripe (dentro de 7 dias): {current_user.stripe_subscription_id}')
            except stripe.error.InvalidRequestError as e:
                if getattr(e, 'code', None) == 'resource_missing':
                    logger.warning(f'Subscrição não encontrada no Stripe, atualizando apenas na BD: {current_user.email}')
                    current_user.subscription_status = 'canceled'
                    db.commit()
                    return {
                        'success': True,
                        'message': 'Subscrição cancelada com sucesso. O teu acesso Pro terminou.',
                        'subscription_status': 'canceled'
                    }
                raise
            current_user.subscription_status = 'canceled'
            db.commit()
            return {
                'success': True,
                'message': 'Subscrição cancelada com sucesso. O teu acesso Pro terminou.',
                'subscription_status': 'canceled'
            }
        
        # 7 ou mais dias: cancelar só no fim do período (não cobrar no próximo mês)
        stripe.Subscription.modify(
            current_user.stripe_subscription_id,
            cancel_at_period_end=True
        )
        current_user.subscription_status = 'cancel_at_period_end'
        db.commit()
        period_end_ts = subscription.get('current_period_end')
        logger.info(f'Subscrição marcada para terminar no fim do período: {current_user.email}')
        return {
            'success': True,
            'message': 'A tua subscrição termina no fim do período atual. Não serás cobrado no próximo mês. Manténs acesso Pro até lá.',
            'subscription_status': 'cancel_at_period_end',
            'current_period_end': period_end_ts
        }
    except HTTPException:
        raise
    except stripe.error.StripeError as e:
        logger.error(f'Erro Stripe ao cancelar subscrição: {str(e)}, tipo: {type(e).__name__}')
        raise HTTPException(status_code=400, detail='Erro ao cancelar subscrição. Tenta novamente.')
    except Exception as e:
        logger.error(f'Erro inesperado ao cancelar subscrição: {str(e)}', exc_info=True)
        raise HTTPException(status_code=500, detail='Erro ao cancelar subscrição. Tenta novamente.')

@router.get('/invoices')
async def get_stripe_invoices(current_user: models.User = Depends(get_current_user)):
    try:
        if not current_user.stripe_customer_id:
            return []
        
        # Verificar se é um customer de simulação/teste (começa com "sim_")
        if current_user.stripe_customer_id.startswith('sim_'):
            logger.debug(f'Customer de simulação detectado: {current_user.stripe_customer_id}. Retornando lista vazia.')
            return []
        
        invoices = stripe.Invoice.list(customer=current_user.stripe_customer_id, limit=10)
        return invoices.data
    except stripe.error.InvalidRequestError as e:
        # Customer não existe ou foi eliminado
        error_code = getattr(e, 'code', None)
        if error_code == 'resource_missing':
            logger.debug(f'Customer não encontrado no Stripe: {current_user.stripe_customer_id}')
            return []
        logger.error(f'Erro ao buscar invoices (InvalidRequestError): {str(e)}')
        return []
    except stripe.error.StripeError as e:
        logger.error(f'Erro Stripe ao buscar invoices: {str(e)}')
        return []
    except Exception as e:
        logger.error(f'Erro inesperado ao buscar invoices: {str(e)}')
        return []

