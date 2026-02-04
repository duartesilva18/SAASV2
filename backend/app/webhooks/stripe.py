from fastapi import APIRouter, Request, HTTPException, Depends
from sqlalchemy.orm import Session
import stripe
import uuid
import logging
from uuid import UUID
from datetime import datetime, date
from ..core.config import settings
from ..core.dependencies import get_db
from ..core.affiliate_commission import get_commission_percentage_for_price_id
from ..models import database as models
from .stripe_connect_handlers import (
    handle_payment_intent_succeeded,
    handle_transfer_created,
    handle_transfer_reversed,
    handle_account_updated
)

router = APIRouter(prefix='/webhooks', tags=['webhooks'])
logger = logging.getLogger(__name__)

@router.post('/stripe')
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload = await request.body()
    sig_header = request.headers.get('stripe-signature')
    secret = (settings.STRIPE_WEBHOOK_SECRET or '').strip()

    if not secret:
        logger.error('STRIPE_WEBHOOK_SECRET não está definido. Define a variável no .env / Render com o "Signing secret" (whsec_...) do endpoint em Stripe → Developers → Webhooks.')
        raise HTTPException(status_code=500, detail='Webhook secret not configured')
    if not sig_header:
        logger.error('Pedido Stripe sem header stripe-signature. Verifica que a URL do webhook no Stripe aponta para este servidor.')
        raise HTTPException(status_code=400, detail='Missing stripe-signature header')

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, secret
        )
    except ValueError as e:
        logger.error(f'Erro ao validar payload do Stripe: {str(e)}')
        raise HTTPException(status_code=400, detail='Invalid payload')
    except stripe.error.SignatureVerificationError as e:
        logger.error(
            f'Erro ao verificar assinatura do Stripe: {str(e)}. '
            'Solução: no Stripe Dashboard → Developers → Webhooks → seleciona o endpoint desta URL → "Reveal" no Signing secret → '
            'copia o valor (whsec_...) e define STRIPE_WEBHOOK_SECRET no ambiente (Render/.env) exatamente com esse valor. '
            'Se usas modo Test vs Live, o secret tem de ser do endpoint correto.'
        )
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
    elif event_type == 'payment_intent.succeeded':
        payment_intent = event['data']['object']
        handle_payment_intent_succeeded(payment_intent, db)
    elif event_type == 'transfer.created':
        transfer = event['data']['object']
        handle_transfer_created(transfer, db)
    elif event_type == 'transfer.reversed':
        transfer = event['data']['object']
        handle_transfer_reversed(transfer, db)
    elif event_type == 'account.updated':
        account = event['data']['object']
        handle_account_updated(account, db)
    elif event_type == 'charge.refunded':
        charge = event['data']['object']
        handle_charge_refunded(charge, db)

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
        
        # Marcar conversão de afiliado se aplicável (após atualizar subscription_status)
        if user.referrer_id:
            referral = db.query(models.AffiliateReferral).filter(
                models.AffiliateReferral.referred_user_id == user.id
            ).first()
            if referral and not referral.has_subscribed:
                referral.has_subscribed = True
                referral.subscription_date = datetime.now()
                logger.info(f'✅ Conversão de afiliado marcada: {referral.referrer_id} -> {user.email} (checkout.completed)')
            elif referral:
                logger.info(f'ℹ️ Referência já estava marcada como subscrita para {user.email}')
            else:
                logger.warning(f'⚠️ Usuário tem referrer_id ({user.referrer_id}) mas não foi encontrada referência em affiliate_referrals para {user.email}')
        
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
        
        # Marcar conversão de afiliado se aplicável
        if user.referrer_id:
            referral = db.query(models.AffiliateReferral).filter(
                models.AffiliateReferral.referred_user_id == user.id
            ).first()
            if referral and not referral.has_subscribed:
                referral.has_subscribed = True
                referral.subscription_date = datetime.now()
                logger.info(f'✅ Conversão de afiliado marcada: {referral.referrer_id} -> {user.email} (subscription.created)')
            elif referral:
                logger.info(f'ℹ️ Referência já estava marcada como subscrita para {user.email}')
            else:
                logger.warning(f'⚠️ Usuário tem referrer_id ({user.referrer_id}) mas não foi encontrada referência em affiliate_referrals para {user.email}')
        
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
    """Processa customer.subscription.deleted - cancelamento ou reembolso; atualiza dados do afiliado."""
    subscription_id = subscription['id']
    
    logger.info(f'Subscrição eliminada: {subscription_id}')
    
    user = db.query(models.User).filter(models.User.stripe_subscription_id == subscription_id).first()
    if user:
        user.subscription_status = 'canceled'
        # Atualizar referência de afiliado: deixar de contar como conversão e registar cancelamento
        referral = db.query(models.AffiliateReferral).filter(
            models.AffiliateReferral.referred_user_id == user.id
        ).first()
        if referral:
            referral.has_subscribed = False
            referral.subscription_canceled_at = datetime.now()
            logger.info(f'Afiliado: referência {user.email} marcada como cancelada (referrer_id={referral.referrer_id})')
            # Ajustar comissão do mês da subscrição: menos uma conversão e estimativa de valor (9,99€, 25%)
            if referral.subscription_date:
                commission_month = referral.subscription_date.replace(day=1).date()
                comm = db.query(models.AffiliateCommission).filter(
                    models.AffiliateCommission.affiliate_id == referral.referrer_id,
                    models.AffiliateCommission.month == commission_month
                ).first()
                if comm and comm.conversions_count > 0:
                    est_revenue_cents = 999  # 9,99€
                    est_commission_cents = int(est_revenue_cents * (float(comm.commission_percentage) / 100))
                    comm.total_revenue_cents = max(0, comm.total_revenue_cents - est_revenue_cents)
                    comm.commission_amount_cents = max(0, comm.commission_amount_cents - est_commission_cents)
                    comm.conversions_count = max(0, comm.conversions_count - 1)
                    logger.info(f'Afiliado: comissão ajustada (mês {commission_month}): -{est_revenue_cents} cêntimos receita, -{est_commission_cents} cêntimos comissão, -1 conversão')
        # Não eliminar o subscription_id para manter histórico
        db.commit()
        logger.info(f'Subscrição cancelada para {user.email}')
    else:
        logger.warning(f'Utilizador não encontrado para subscrição eliminada: {subscription_id}')


def handle_charge_refunded(charge: dict, db: Session):
    """Processa charge.refunded - reembolso; atualiza dados do afiliado e reverte o transfer no Stripe Connect."""
    charge_id = charge.get('id')
    amount_refunded = charge.get('amount_refunded') or charge.get('amount', 0)  # cêntimos (refund total ou parcial)
    customer_id = charge.get('customer')
    invoice_id = charge.get('invoice')
    transfer_id = charge.get('transfer')  # transfer para a conta Connect do afiliado (se existir)

    logger.info(f'Reembolso: charge={charge_id} amount_refunded={amount_refunded} customer={customer_id} transfer={transfer_id}')

    user = None
    if customer_id:
        user = db.query(models.User).filter(models.User.stripe_customer_id == customer_id).first()
    if not user and invoice_id and settings.STRIPE_API_KEY:
        try:
            inv = stripe.Invoice.retrieve(invoice_id)
            sub_id = inv.get('subscription')
            if sub_id:
                user = db.query(models.User).filter(models.User.stripe_subscription_id == sub_id).first()
        except Exception as e:
            logger.warning(f'Erro ao obter invoice {invoice_id} para charge.refunded: {e}')

    if not user:
        logger.warning(f'Utilizador não encontrado para reembolso charge {charge_id}')
        return

    referral = db.query(models.AffiliateReferral).filter(
        models.AffiliateReferral.referred_user_id == user.id
    ).first()
    if not referral:
        logger.info(f'Reembolso para {user.email} sem referência de afiliado; nada a reverter.')
        return

    # Atualizar referência
    referral.has_subscribed = False
    referral.subscription_canceled_at = datetime.now()

    # Mês da comissão: a partir da invoice ou da data do charge
    commission_month = date.today().replace(day=1)
    if invoice_id and settings.STRIPE_API_KEY:
        try:
            inv = stripe.Invoice.retrieve(invoice_id)
            period_start = inv.get('period_start')
            if period_start is not None:
                commission_month = datetime.fromtimestamp(period_start).date().replace(day=1)
        except Exception:
            pass

    # Obter percentagem de comissão (invoice price ou default 25%)
    commission_pct = 25.0
    if invoice_id and settings.STRIPE_API_KEY:
        try:
            inv = stripe.Invoice.retrieve(invoice_id, expand=['lines.data.price'])
            lines = (inv.get('lines') or {}).get('data') or []
            if lines:
                price = lines[0].get('price')
                price_id = price.get('id') if isinstance(price, dict) else price
                if price_id:
                    commission_pct = get_commission_percentage_for_price_id(price_id, db)
        except Exception:
            pass

    commission_to_reverse_cents = int(amount_refunded * (commission_pct / 100))

    # Ajustar comissão na BD
    comm = db.query(models.AffiliateCommission).filter(
        models.AffiliateCommission.affiliate_id == referral.referrer_id,
        models.AffiliateCommission.month == commission_month
    ).first()
    if comm and comm.conversions_count > 0:
        comm.total_revenue_cents = max(0, comm.total_revenue_cents - amount_refunded)
        comm.commission_amount_cents = max(0, comm.commission_amount_cents - commission_to_reverse_cents)
        comm.conversions_count = max(0, comm.conversions_count - 1)
        logger.info(f'Afiliado: comissão ajustada (reembolso): -{amount_refunded} receita, -{commission_to_reverse_cents} comissão, -1 conversão')

    # Reverter o transfer no Stripe Connect (tirar o valor da comissão ao afiliado)
    if not transfer_id and settings.STRIPE_API_KEY:
        # Fallback: em subscrições o transfer pode estar separado do charge; procurar por source_transaction
        try:
            transfers = stripe.Transfer.list(limit=100)
            for t in transfers.get('data', []):
                if t.get('source_transaction') == charge_id:
                    transfer_id = t.get('id')
                    logger.info(f'Transfer encontrado por source_transaction: {transfer_id}')
                    break
        except Exception as e:
            logger.warning(f'Erro ao listar transfers para charge {charge_id}: {e}')

    if transfer_id and commission_to_reverse_cents >= 1 and settings.STRIPE_API_KEY:
        try:
            stripe.Transfer.create_reversal(transfer_id, amount=commission_to_reverse_cents)
            logger.info(f'Stripe Connect: transfer {transfer_id} revertido em {commission_to_reverse_cents} cêntimos (comissão devolvida à plataforma)')
        except stripe.error.InvalidRequestError as e:
            logger.warning(f'Não foi possível reverter transfer {transfer_id}: {e}. Pode já estar revertido ou ser de outro tipo.')
        except Exception as e:
            logger.error(f'Erro ao reverter transfer {transfer_id}: {e}', exc_info=True)

    db.commit()
    logger.info(f'Reembolso processado: {user.email}, afiliado referrer_id={referral.referrer_id}')


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
                        logger.info(f'Subscrição reativada após pagamento: {user.email}')
                except Exception as e:
                    logger.error(f'Erro ao verificar subscrição após pagamento: {str(e)}')
            
            # Marcar conversão de afiliado e criar/atualizar comissão (subscrições)
            if user.referrer_id:
                referral = db.query(models.AffiliateReferral).filter(
                    models.AffiliateReferral.referred_user_id == user.id
                ).first()
                referrer = db.query(models.User).filter(models.User.id == user.referrer_id).first() if user.referrer_id else None
                # Transfer manual só em invoice.paid (nunca em checkout.session.completed) — garante que o dinheiro existe.
                # Comissão em cima de invoice.amount_paid (consistente; se acordo for "menos taxas Stripe", alterar aqui).
                # Workaround: 1ª invoice (Checkout) pode ter sido criada sem split; Stripe não recalcula invoices.
                billing_reason = invoice.get('billing_reason')
                invoice_id = invoice.get('id')
                if billing_reason == 'subscription_create' and referral and referrer and getattr(referrer, 'stripe_connect_account_id', None) and invoice_id:
                    # Evitar pagamento duplo: só fazemos Transfer se ainda não registámos para esta invoice
                    existing = db.query(models.AffiliateInvoiceManualTransfer).filter(
                        models.AffiliateInvoiceManualTransfer.invoice_id == invoice_id
                    ).first()
                    if existing:
                        logger.info(f'Transfer manual já feito para invoice {invoice_id}, a ignorar (evitar duplicado)')
                    else:
                        charge_id = invoice.get('charge')
                        if charge_id and settings.STRIPE_API_KEY:
                            try:
                                stripe.api_key = settings.STRIPE_API_KEY
                                charge = stripe.Charge.retrieve(charge_id)
                                # Só Transfer manual se: sem transfer associado E sem application_fee (split não foi aplicado)
                                has_transfer = bool(charge.get('transfer'))
                                app_fee = charge.get('application_fee_amount') or 0
                                if not has_transfer and app_fee == 0:
                                    amount_paid = invoice.get('amount_paid') or 0  # base: amount_paid (consistente)
                                    lines = (invoice.get('lines') or {}).get('data') or []
                                    price_id = None
                                    if lines:
                                        price_obj = lines[0].get('price')
                                        price_id = price_obj if isinstance(price_obj, str) else (price_obj.get('id') if price_obj else None)
                                    commission_pct = get_commission_percentage_for_price_id(price_id or '', db) if price_id else 20.0
                                    commission_cents = int(amount_paid * (commission_pct / 100))
                                    if commission_cents >= 1:
                                        currency = invoice.get('currency') or 'eur'
                                        t = stripe.Transfer.create(
                                            amount=commission_cents,
                                            currency=currency,
                                            destination=referrer.stripe_connect_account_id,
                                            metadata={'invoice_id': invoice_id, 'reason': 'first_invoice_split_fix'},
                                            idempotency_key=f"first_invoice_split_{invoice_id}"
                                        )
                                        db.add(models.AffiliateInvoiceManualTransfer(
                                            invoice_id=invoice_id,
                                            transfer_id=t.id,
                                            affiliate_id=referrer.id,
                                            amount_cents=commission_cents,
                                            currency=currency,
                                        ))
                                        db.commit()
                                        logger.info(f'✅ Transfer manual (1ª invoice sem split): {commission_cents} {currency} → afiliado {referrer.email} (invoice {invoice_id})')
                                elif has_transfer:
                                    logger.info(f'Invoice {invoice_id} já tem transfer; não criar Transfer manual')
                                else:
                                    logger.info(f'Invoice {invoice_id} tem application_fee_amount={app_fee}; não criar Transfer manual')
                            except Exception as e:
                                logger.error(f'Erro ao criar Transfer manual para 1ª invoice: {e}', exc_info=True)
                                db.rollback()
                if referral and not referral.has_subscribed:
                    referral.has_subscribed = True
                    referral.subscription_date = datetime.now()
                    logger.info(f'✅ Conversão de afiliado marcada: {referral.referrer_id} -> {user.email} (invoice.paid)')
                elif referral and user.subscription_status in ['active', 'trialing']:
                    if not referral.has_subscribed:
                        referral.has_subscribed = True
                        referral.subscription_date = datetime.now()
                        logger.info(f'✅ Conversão de afiliado marcada (correção): {referral.referrer_id} -> {user.email} (invoice.paid)')

                # Criar ou atualizar AffiliateCommission para pagamentos de subscrição (invoice.paid)
                # Assim as comissões ficam registadas mesmo quando payment_intent.succeeded não traz user_id
                if referral:
                    try:
                        amount_paid = invoice.get('amount_paid') or 0  # cêntimos
                        period_start = invoice.get('period_start')
                        if period_start is not None:
                            period_dt = datetime.fromtimestamp(period_start)
                            commission_month = period_dt.replace(day=1).date()
                        else:
                            commission_month = date.today().replace(day=1)

                        # Comissão por plano: Plus 20%, Pro 25% (a partir do price da invoice)
                        price_id = None
                        lines = (invoice.get('lines') or {}).get('data') or []
                        if lines:
                            price_obj = lines[0].get('price')
                            price_id = price_obj if isinstance(price_obj, str) else (price_obj.get('id') if price_obj else None)
                        commission_pct = get_commission_percentage_for_price_id(price_id or '', db) if price_id else 20.0
                        commission_amount_cents = int(amount_paid * (commission_pct / 100))

                        existing = db.query(models.AffiliateCommission).filter(
                            models.AffiliateCommission.affiliate_id == referral.referrer_id,
                            models.AffiliateCommission.month == commission_month
                        ).first()

                        if existing:
                            existing.total_revenue_cents += amount_paid
                            existing.commission_amount_cents += commission_amount_cents
                            existing.conversions_count += 1
                            logger.info(f'Comissão atualizada (invoice.paid): afiliado {referral.referrer_id}, mês {commission_month}, +{amount_paid} cêntimos')
                        else:
                            new_commission = models.AffiliateCommission(
                                affiliate_id=referral.referrer_id,
                                month=commission_month,
                                total_revenue_cents=amount_paid,
                                commission_percentage=commission_pct,
                                commission_amount_cents=commission_amount_cents,
                                conversions_count=1,
                                referrals_count=1,
                                is_paid=False,
                            )
                            db.add(new_commission)
                            logger.info(f'Comissão criada (invoice.paid): afiliado {referral.referrer_id}, mês {commission_month}, {amount_paid} cêntimos')
                    except Exception as e:
                        logger.error(f'Erro ao criar/atualizar comissão em invoice.paid: {str(e)}', exc_info=True)

            db.commit()

