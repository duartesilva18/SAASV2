from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.orm import Session
import stripe
from ..core.config import settings
from ..core.dependencies import get_db
from ..models import database as models
from .auth import get_current_user
import logging
from sqlalchemy import and_

router = APIRouter(prefix='/stripe', tags=['stripe'])
stripe.api_key = settings.STRIPE_API_KEY
STRIPE_WEBHOOK_SECRET = settings.STRIPE_WEBHOOK_SECRET

logger = logging.getLogger(__name__)

@router.post('/create-checkout-session')
async def create_checkout_session(price_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    try:
        customer_id = current_user.stripe_customer_id
        
        if not customer_id:
            customer = stripe.Customer.create(
                email=current_user.email,
                metadata={'user_id': str(current_user.id)}
            )
            customer_id = customer.id
            current_user.stripe_customer_id = customer_id
            db.commit()
        
        # Buscar preço para calcular total
        price = stripe.Price.retrieve(price_id)
        total_amount_cents = price.unit_amount  # Valor total em cêntimos
        
        # Verificar se cliente tem referrer_id e se referrer tem Stripe Connect ativo
        application_fee_amount = None
        transfer_data = None
        referrer_id = None
        
        if current_user.referrer_id:
            referrer = db.query(models.User).filter(models.User.id == current_user.referrer_id).first()
            logger.info(f'🔍 Verificando referrer para divisão automática: referrer_id={current_user.referrer_id}, referrer={referrer.email if referrer else None}, is_affiliate={referrer.is_affiliate if referrer else False}, has_connect_account={bool(referrer.stripe_connect_account_id) if referrer else False}')
            
            if referrer and referrer.is_affiliate and referrer.stripe_connect_account_id:
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
                        logger.info(f'📊 Status Stripe Connect do afiliado {referrer.email}: details_submitted={details_submitted}, charges_enabled={charges_enabled}, payouts_enabled={payouts_enabled}, is_connect_active={is_connect_active}')
                    else:
                        # Se Stripe não está configurado, usar status local
                        is_connect_active = referrer.stripe_connect_onboarding_completed
                        logger.info(f'⚠️ Stripe API não configurada, usando status local: is_connect_active={is_connect_active}')
                except Exception as e:
                    logger.warning(f'Erro ao verificar status Stripe Connect do afiliado: {str(e)}. Usando status local.')
                    is_connect_active = referrer.stripe_connect_onboarding_completed
                
                if is_connect_active:
                    # Buscar percentagem de comissão
                    commission_setting = db.query(models.SystemSetting).filter(
                        models.SystemSetting.key == 'affiliate_commission_percentage'
                    ).first()
                    commission_percentage = float(commission_setting.value) if commission_setting else 20.0
                    
                    # Calcular comissão
                    application_fee_amount = int(total_amount_cents * (commission_percentage / 100))
                    referrer_id = str(referrer.id)
                    
                    transfer_data = {
                        'destination': referrer.stripe_connect_account_id,
                    }
                    
                    logger.info(f'Divisão automática configurada: {application_fee_amount} cêntimos para afiliado {referrer.email} (account: {referrer.stripe_connect_account_id})')
        
        # Criar checkout session
        subscription_data = {
            'metadata': {
                'user_id': str(current_user.id),
                'referrer_id': referrer_id if referrer_id else ''
            }
        }
        
        # Adicionar divisão automática se aplicável
        # Para subscriptions, usar subscription_data com application_fee_percent
        # application_fee_percent = percentagem que a PLATAFORMA fica (o resto vai para transfer_data.destination)
        # Queremos afiliado a receber commission_percentage (ex: 20%), logo plataforma fica 100 - commission (ex: 80%)
        if application_fee_amount and transfer_data:
            application_fee_percent = round(100 - commission_percentage, 2)
            
            subscription_data['application_fee_percent'] = application_fee_percent
            subscription_data['transfer_data'] = transfer_data
            subscription_data['metadata']['commission_percentage'] = str(commission_percentage)
            subscription_data['metadata']['commission_amount_cents'] = str(application_fee_amount)
        
        session_params = {
            'customer': customer_id,
            'payment_method_types': ['card'],
            'line_items': [{
                'price': price_id,
                'quantity': 1,
            }],
            'mode': 'subscription',
            'client_reference_id': str(current_user.id),
            'success_url': f"{settings.FRONTEND_URL}/dashboard?session_id={{CHECKOUT_SESSION_ID}}",
            'cancel_url': f"{settings.FRONTEND_URL}/pricing",
            'subscription_data': subscription_data
        }
        
        checkout_session = stripe.checkout.Session.create(**session_params)
        
        return {'url': checkout_session.url}
    except Exception as e:
        logger.error(f'Erro Stripe Checkout: {str(e)}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))

@router.post('/change-plan')
async def change_plan(price_id: str, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Altera o plano da subscrição ativa do utilizador para o novo price_id (upgrade/downgrade com proration)."""
    try:
        if not current_user.stripe_subscription_id:
            raise HTTPException(
                status_code=400,
                detail='Não tens uma subscrição ativa. Subscreve primeiro um plano em Planos ou Preços.'
            )
        if current_user.subscription_status not in ('active', 'trialing', 'cancel_at_period_end'):
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
        stripe.Subscription.modify(
            current_user.stripe_subscription_id,
            items=[{'id': item_id, 'price': price_id}]
        )
        # Atualizar localmente para resposta imediata (o webhook subscription.updated também atualiza)
        sub_after = stripe.Subscription.retrieve(current_user.stripe_subscription_id)
        current_user.subscription_status = sub_after.status
        db.commit()
        logger.info(f'Plano alterado para price_id={price_id} para user {current_user.email}')
        return {'success': True, 'message': 'Plano alterado.', 'subscription_status': sub_after.status}
    except stripe.error.StripeError as e:
        logger.error(f'Erro Stripe ao alterar plano: {str(e)}', exc_info=True)
        raise HTTPException(status_code=400, detail=str(e))
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
            detail=f'Erro ao aceder ao portal: {str(e)}'
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
                from datetime import datetime
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
                                referral.subscription_date = datetime.now()
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
        raise HTTPException(status_code=400, detail=f'Erro ao verificar sessão: {str(e)}')
    except Exception as e:
        logger.error(f'Erro inesperado ao verificar sessão: {str(e)}')
        raise HTTPException(status_code=500, detail='Erro ao verificar sessão')

@router.get('/subscription-details')
async def get_subscription_details(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Retorna os detalhes da subscrição atual, incluindo o price_id"""
    try:
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
            
            # Obter price_id da subscrição (Stripe retorna items como dict-like)
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

@router.post('/cancel-subscription')
async def cancel_subscription(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    """Cancela a subscrição do utilizador (no final do período atual)"""
    try:
        logger.info(f'Tentativa de cancelar subscrição para {current_user.email}, subscription_id: {current_user.stripe_subscription_id}')
        
        if not current_user.stripe_subscription_id:
            logger.warning(f'Utilizador {current_user.email} tentou cancelar mas não tem subscription_id')
            raise HTTPException(status_code=400, detail='Não tens uma subscrição ativa para cancelar.')
        
        # Verificar se a subscrição já está cancelada
        if current_user.subscription_status == 'cancel_at_period_end':
            logger.info(f'Subscrição já está marcada para cancelamento: {current_user.email}')
            return {
                'success': True,
                'message': 'Subscrição já está marcada para cancelamento.',
                'subscription_status': 'cancel_at_period_end'
            }
        
        # Verificar se é subscrição de simulação/teste
        if current_user.stripe_customer_id and (current_user.stripe_customer_id.startswith('sim_') or current_user.stripe_customer_id.startswith('test_')):
            logger.info(f'Subscrição de simulação - marcando como cancel_at_period_end sem chamar Stripe: {current_user.email}')
            current_user.subscription_status = 'cancel_at_period_end'
            db.commit()
            return {
                'success': True,
                'message': 'Subscrição será cancelada no final do período atual.',
                'subscription_status': 'cancel_at_period_end'
            }
        
        # Cancelar subscrição no Stripe (cancel_at_period_end = True)
        try:
            subscription = stripe.Subscription.modify(
                current_user.stripe_subscription_id,
                cancel_at_period_end=True
            )
            logger.info(f'Subscrição modificada no Stripe: {subscription.id}, cancel_at_period_end: {subscription.cancel_at_period_end}')
        except stripe.error.InvalidRequestError as e:
            logger.error(f'Erro Stripe InvalidRequestError: {str(e)}, code: {getattr(e, "code", None)}')
            # Se a subscrição não existe no Stripe, apenas atualizar na BD
            if getattr(e, 'code', None) == 'resource_missing':
                logger.warning(f'Subscrição não encontrada no Stripe, atualizando apenas na BD: {current_user.email}')
                current_user.subscription_status = 'cancel_at_period_end'
                db.commit()
                return {
                    'success': True,
                    'message': 'Subscrição será cancelada no final do período atual.',
                    'subscription_status': 'cancel_at_period_end'
                }
            raise
        
        # Atualizar status na base de dados
        current_user.subscription_status = 'cancel_at_period_end'
        db.commit()
        
        logger.info(f'Subscrição {current_user.stripe_subscription_id} marcada para cancelamento no final do período para {current_user.email}')
        
        return {
            'success': True,
            'message': 'Subscrição será cancelada no final do período atual.',
            'subscription_status': 'cancel_at_period_end'
        }
    except HTTPException:
        raise
    except stripe.error.StripeError as e:
        logger.error(f'Erro Stripe ao cancelar subscrição: {str(e)}, tipo: {type(e).__name__}')
        raise HTTPException(status_code=400, detail=f'Erro ao cancelar subscrição: {str(e)}')
    except Exception as e:
        logger.error(f'Erro inesperado ao cancelar subscrição: {str(e)}', exc_info=True)
        raise HTTPException(status_code=500, detail=f'Erro ao cancelar subscrição: {str(e)}')

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

