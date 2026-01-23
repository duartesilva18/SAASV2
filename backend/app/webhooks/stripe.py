from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
import stripe
import uuid
import logging
from ..core.config import settings
from ..core.dependencies import get_db
from ..models import database as models
from datetime import datetime

router = APIRouter(prefix='/webhooks', tags=['webhooks'])
logger = logging.getLogger(__name__)

@router.post('/stripe')
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, settings.STRIPE_WEBHOOK_SECRET
        )
    except ValueError as e:
        logger.error(f'Erro ao validar payload do Stripe: {str(e)}')
        raise HTTPException(status_code=400, detail='Invalid payload')
    except stripe.error.SignatureVerificationError as e:
        logger.error(f'Erro ao verificar assinatura do Stripe: {str(e)}')
        raise HTTPException(status_code=400, detail='Invalid signature')

    event_type = event['type']
    logger.info(f'Evento Stripe recebido: {event_type}')

    if event_type == 'checkout.session.completed':
        session = event['data']['object']
        handle_checkout_completed(session, db)
    elif event_type == 'customer.subscription.created':
        subscription = event['data']['object']
        handle_subscription_created(subscription, db)
    elif event_type == 'customer.subscription.updated':
        subscription = event['data']['object']
        handle_subscription_updated(subscription, db)
    elif event_type == 'customer.subscription.deleted':
        subscription = event['data']['object']
        handle_subscription_deleted(subscription, db)
    elif event_type == 'invoice.payment_failed':
        invoice = event['data']['object']
        handle_invoice_payment_failed(invoice, db)
    elif event_type == 'invoice.paid':
        invoice = event['data']['object']
        handle_invoice_paid(invoice, db)

    return {'status': 'success'}

def handle_checkout_completed(session: dict, db: Session):
    """Processa checkout.session.completed"""
    customer_id = session.get('customer')
    subscription_id = session.get('subscription')
    user_id_str = session.get('client_reference_id')
    
    logger.info(f'Checkout completed - Customer: {customer_id}, Subscription: {subscription_id}, User ID: {user_id_str}')
    
    user = None
    
    # 1. Tentar encontrar por client_reference_id (mais robusto)
    if user_id_str:
        try:
            # Converter string para UUID
            user_uuid = uuid.UUID(user_id_str)
            user = db.query(models.User).filter(models.User.id == user_uuid).first()
            if user:
                logger.info(f'Utilizador encontrado por client_reference_id: {user.email}')
        except (ValueError, TypeError) as e:
            logger.warning(f'Erro ao converter user_id para UUID: {user_id_str}, erro: {str(e)}')
    
    # 2. Tentar encontrar por customer_id
    if not user and customer_id:
        user = db.query(models.User).filter(models.User.stripe_customer_id == customer_id).first()
        if user:
            logger.info(f'Utilizador encontrado por customer_id: {user.email}')
    
    if not user:
        logger.error(f'Utilizador não encontrado para checkout. Customer: {customer_id}, User ID: {user_id_str}')
        return
    
    # Atualizar subscrição
    try:
        user.stripe_subscription_id = subscription_id
        # Para checkout.session.completed, a subscrição pode ainda não estar completamente ativa
        # Vamos buscar o status real da subscrição do Stripe
        if subscription_id:
            try:
                subscription = stripe.Subscription.retrieve(subscription_id)
                user.subscription_status = subscription.status  # 'active', 'trialing', etc.
                logger.info(f'Status da subscrição do Stripe: {subscription.status}')
            except Exception as e:
                logger.warning(f'Erro ao buscar subscrição do Stripe: {str(e)}, usando status "active"')
                user.subscription_status = 'active'
        else:
            user.subscription_status = 'active'
        
        if not user.stripe_customer_id:
            user.stripe_customer_id = customer_id
        
        db.commit()
        db.refresh(user)
        logger.info(f'Subscrição atualizada para {user.email}: status={user.subscription_status}, subscription_id={subscription_id}')
    except Exception as e:
        logger.error(f'Erro ao atualizar subscrição para {user.email}: {str(e)}')
        db.rollback()
        raise

def handle_subscription_created(subscription: dict, db: Session):
    """Processa customer.subscription.created"""
    subscription_id = subscription['id']
    customer_id = subscription.get('customer')
    status = subscription.get('status', 'active')
    
    logger.info(f'Subscrição criada: {subscription_id}, Customer: {customer_id}, Status: {status}')
    
    user = db.query(models.User).filter(models.User.stripe_customer_id == customer_id).first()
    if user:
        user.stripe_subscription_id = subscription_id
        user.subscription_status = status
        db.commit()
        logger.info(f'Subscrição criada atualizada para {user.email}: {status}')

def handle_subscription_updated(subscription: dict, db: Session):
    """Processa customer.subscription.updated"""
    subscription_id = subscription['id']
    status = subscription.get('status')
    cancel_at_period_end = subscription.get('cancel_at_period_end', False)
    
    logger.info(f'Subscrição atualizada: {subscription_id}, Status: {status}, Cancel at period end: {cancel_at_period_end}')
    
    user = db.query(models.User).filter(models.User.stripe_subscription_id == subscription_id).first()
    if user:
        # Se cancel_at_period_end é True, usar status especial
        if cancel_at_period_end and status == 'active':
            user.subscription_status = 'cancel_at_period_end'
        else:
            user.subscription_status = status
        db.commit()
        logger.info(f'Status da subscrição atualizado para {user.email}: {user.subscription_status}')
    else:
        logger.warning(f'Utilizador não encontrado para subscrição: {subscription_id}')

def handle_subscription_deleted(subscription: dict, db: Session):
    """Processa customer.subscription.deleted"""
    subscription_id = subscription['id']
    
    logger.info(f'Subscrição eliminada: {subscription_id}')
    
    user = db.query(models.User).filter(models.User.stripe_subscription_id == subscription_id).first()
    if user:
        user.subscription_status = 'canceled'
        # Não eliminar o subscription_id para manter histórico
        db.commit()
        logger.info(f'Subscrição cancelada para {user.email}')
    else:
        logger.warning(f'Utilizador não encontrado para subscrição eliminada: {subscription_id}')

def handle_invoice_payment_failed(invoice: dict, db: Session):
    """Processa invoice.payment_failed - quando um pagamento falha"""
    customer_id = invoice.get('customer')
    subscription_id = invoice.get('subscription')
    invoice_period_end = invoice.get('period_end')  # Timestamp do fim do período da fatura
    
    logger.warning(f'Pagamento falhou - Invoice: {invoice.get("id")}, Customer: {customer_id}, Subscription: {subscription_id}')
    
    # Se a fatura está associada a uma subscrição, verificar se é para o período atual
    if subscription_id:
        user = db.query(models.User).filter(models.User.stripe_subscription_id == subscription_id).first()
        if user:
            try:
                subscription = stripe.Subscription.retrieve(subscription_id)
                current_period_end = subscription.current_period_end  # Timestamp do fim do período atual
                current_time = datetime.now().timestamp()
                
                # Só atualizar o status se:
                # 1. A fatura é para o período atual (period_end <= current_period_end) OU
                # 2. O período atual já terminou (current_time >= current_period_end) E a subscrição está realmente 'past_due' ou 'unpaid'
                is_current_period_invoice = invoice_period_end and invoice_period_end <= current_period_end
                period_has_ended = current_time >= current_period_end
                
                if subscription.status in ['past_due', 'unpaid']:
                    # Só atualizar se for fatura do período atual ou se o período já terminou
                    if is_current_period_invoice or period_has_ended:
                        user.subscription_status = subscription.status
                        db.commit()
                        logger.warning(f'Status da subscrição atualizado para {subscription.status} devido a pagamento falhado: {user.email}')
                    else:
                        logger.info(f'Pagamento falhou para fatura futura (próximo ciclo). Mantendo acesso até {datetime.fromtimestamp(current_period_end)}: {user.email}')
                elif subscription.status == 'active':
                    # Se ainda está ativo, não fazer nada (pode ser tentativa de pagamento futuro)
                    logger.info(f'Subscrição ainda ativa após falha de pagamento. Pode ser fatura futura: {user.email}')
            except Exception as e:
                logger.error(f'Erro ao buscar subscrição após pagamento falhado: {str(e)}')

def handle_invoice_paid(invoice: dict, db: Session):
    """Processa invoice.paid - quando uma fatura é paga com sucesso"""
    customer_id = invoice.get('customer')
    subscription_id = invoice.get('subscription')
    
    logger.info(f'Fatura paga com sucesso - Invoice: {invoice.get("id")}, Customer: {customer_id}, Subscription: {subscription_id}')
    
    # Se a fatura está associada a uma subscrição, garantir que o status está correto
    if subscription_id:
        user = db.query(models.User).filter(models.User.stripe_subscription_id == subscription_id).first()
        if user:
            # Se o status estava 'past_due' ou 'unpaid', atualizar para 'active'
            if user.subscription_status in ['past_due', 'unpaid']:
                try:
                    subscription = stripe.Subscription.retrieve(subscription_id)
                    if subscription.status == 'active':
                        user.subscription_status = 'active'
                        db.commit()
                        logger.info(f'Subscrição reativada após pagamento: {user.email}')
                except Exception as e:
                    logger.error(f'Erro ao verificar subscrição após pagamento: {str(e)}')

