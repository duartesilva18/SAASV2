"""Handlers para webhooks do Stripe Connect"""
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, date, timezone, timedelta
from ..models import database as models
from ..core.affiliate_commission import get_commission_percentage_for_price_id
import logging
import stripe
from ..core.config import settings

logger = logging.getLogger(__name__)


def handle_payment_intent_succeeded(payment_intent: dict, db: Session):
    """
    Processa payment_intent.succeeded — APENAS marca comissão existente como paga
    se houver transfer_data (divisão automática via Connect).
    
    NOTA: A criação/atualização de valores de comissão é responsabilidade exclusiva
    de handle_invoice_paid (em stripe.py), que tem idempotência via AffiliateCommissionInvoice.
    Este handler NÃO cria comissões nem soma valores — apenas marca is_paid/transfer_status.
    """
    try:
        # Verificar se tem transfer_data (divisão automática)
        transfer_data = payment_intent.get('transfer_data')
        if not transfer_data:
            charges = payment_intent.get('charges', {})
            charge = None
            if isinstance(charges, dict):
                charge_data = charges.get('data') or []
                if charge_data:
                    charge = charge_data[0]
            if charge:
                transfer_data = charge.get('transfer_data')
        if not transfer_data:
            return  # Não é uma divisão automática
        
        destination_account = transfer_data.get('destination')
        if not destination_account:
            return
        
        # Buscar afiliado pela conta Stripe Connect
        affiliate = db.query(models.User).filter(
            models.User.stripe_connect_account_id == destination_account
        ).first()
        
        if not affiliate or not affiliate.is_affiliate:
            logger.warning(f'Conta Stripe Connect não encontrada ou não é afiliado: {destination_account}')
            return
        
        # Determinar mês correto a partir da invoice (se disponível)
        current_month = date.today().replace(day=1)
        invoice_id = payment_intent.get('invoice')
        if invoice_id and settings.STRIPE_API_KEY:
            try:
                stripe.api_key = settings.STRIPE_API_KEY
                inv = stripe.Invoice.retrieve(invoice_id)
                period_start = inv.get('period_start')
                if period_start is not None:
                    current_month = datetime.fromtimestamp(period_start, tz=timezone.utc).date().replace(day=1)
            except Exception as e:
                logger.warning(f'Erro ao obter period_start da invoice {invoice_id} em payment_intent.succeeded: {e}')
        
        # Buscar comissão existente para este mês (criada por invoice.paid)
        commission = db.query(models.AffiliateCommission).filter(
            models.AffiliateCommission.affiliate_id == affiliate.id,
            models.AffiliateCommission.month == current_month
        ).first()
        
        if commission and not commission.is_paid:
            # Apenas marcar como paga — os valores já foram calculados por invoice.paid
            commission.is_paid = True
            commission.paid_at = datetime.now(timezone.utc)
            commission.transfer_status = 'created'
            db.commit()
            logger.info(f'✅ Comissão marcada como paga via divisão automática: afiliado {affiliate.email}, payment_intent {payment_intent.get("id")}')
        elif commission:
            logger.info(f'Comissão já estava paga para afiliado {affiliate.email}, mês {current_month}')
        else:
            # invoice.paid ainda não correu — não criar comissão aqui, será criada por invoice.paid
            logger.info(f'Comissão para mês {current_month} ainda não existe; invoice.paid irá criá-la. PI: {payment_intent.get("id")}')
        
    except Exception as e:
        db.rollback()
        logger.error(f'Erro ao processar payment_intent.succeeded: {str(e)}', exc_info=True)


def handle_transfer_created(transfer: dict, db: Session):
    """Processa transfer.created - captura stripe_transfer_id na comissão correspondente."""
    try:
        transfer_id = transfer.get('id')
        if not transfer_id:
            return
        destination = transfer.get('destination')
        if not destination:
            return
        
        # Buscar afiliado pela conta Stripe Connect
        affiliate = db.query(models.User).filter(
            models.User.stripe_connect_account_id == destination
        ).first()
        
        if not affiliate:
            logger.warning(f'Afiliado não encontrado para conta Stripe Connect: {destination}')
            return
        
        # Determinar mês correto a partir do source_transaction (charge → invoice → period_start)
        target_month = date.today().replace(day=1)
        source_transaction = transfer.get('source_transaction')
        if source_transaction and settings.STRIPE_API_KEY:
            try:
                stripe.api_key = settings.STRIPE_API_KEY
                charge = stripe.Charge.retrieve(source_transaction)
                inv_id = charge.get('invoice') if isinstance(charge, dict) else getattr(charge, 'invoice', None)
                if inv_id:
                    inv = stripe.Invoice.retrieve(inv_id)
                    period_start = inv.get('period_start') if isinstance(inv, dict) else getattr(inv, 'period_start', None)
                    if period_start is not None:
                        target_month = datetime.fromtimestamp(period_start, tz=timezone.utc).date().replace(day=1)
            except Exception as e:
                logger.warning(f'Erro ao obter period_start do transfer {transfer_id}: {e}')
        
        # Buscar comissão pelo mês correto E sem transfer_id (evitar stampar comissão errada)
        commission = db.query(models.AffiliateCommission).filter(
            models.AffiliateCommission.affiliate_id == affiliate.id,
            models.AffiliateCommission.month == target_month,
            models.AffiliateCommission.stripe_transfer_id.is_(None)
        ).order_by(models.AffiliateCommission.created_at.desc()).first()

        # Fallback: mês anterior (caso o transfer chegue no início do mês seguinte)
        if not commission:
            prev_month = (target_month.replace(day=1) - timedelta(days=1)).replace(day=1)
            commission = db.query(models.AffiliateCommission).filter(
                models.AffiliateCommission.affiliate_id == affiliate.id,
                models.AffiliateCommission.month == prev_month,
                models.AffiliateCommission.stripe_transfer_id.is_(None)
            ).order_by(models.AffiliateCommission.created_at.desc()).first()
        
        if commission:
            commission.stripe_transfer_id = transfer_id
            commission.payment_reference = transfer_id
            commission.is_paid = True
            commission.paid_at = datetime.now(timezone.utc)
            db.commit()
            logger.info(f'✅ Transfer ID capturado: {transfer_id} para comissão {commission.id} (marcada como paga)')
        else:
            logger.warning(f'Comissão não encontrada para atualizar transfer_id {transfer_id} (mês={target_month})')
        
    except Exception as e:
        db.rollback()
        logger.error(f'Erro ao processar transfer.created: {str(e)}', exc_info=True)


def handle_transfer_reversed(transfer: dict, db: Session):
    """Processa transfer.reversed - reverte status da comissão e limpa paid_at."""
    try:
        transfer_id = transfer.get('id')
        
        # Buscar comissão pelo transfer_id
        commission = db.query(models.AffiliateCommission).filter(
            models.AffiliateCommission.stripe_transfer_id == transfer_id
        ).first()
        
        if not commission:
            logger.warning(f'Comissão não encontrada para transfer revertido: {transfer_id}')
            return
        
        commission.transfer_status = 'reversed'
        commission.is_paid = False
        commission.paid_at = None  # Limpar: já não foi paga
        commission.payout_error_message = 'Transfer was reversed by Stripe'
        db.commit()
        
        logger.warning(f'⚠️ Transfer revertido: {transfer_id} para comissão {commission.id}')
        
    except Exception as e:
        db.rollback()
        logger.error(f'Erro ao processar transfer.reversed: {str(e)}', exc_info=True)


def handle_account_updated(account: dict, db: Session):
    """Processa account.updated - atualiza status do onboarding"""
    try:
        account_id = account.get('id')
        
        # Buscar afiliado pela conta Stripe Connect
        affiliate = db.query(models.User).filter(
            models.User.stripe_connect_account_id == account_id
        ).first()
        
        if not affiliate:
            logger.warning(f'Afiliado não encontrado para conta Stripe Connect: {account_id}')
            return
        
        # Atualizar status
        details_submitted = account.get('details_submitted', False)
        charges_enabled = account.get('charges_enabled', False)
        payouts_enabled = account.get('payouts_enabled', False)
        
        affiliate.stripe_connect_onboarding_completed = details_submitted and charges_enabled
        
        if details_submitted and charges_enabled:
            if payouts_enabled:
                affiliate.stripe_connect_account_status = 'active'
                affiliate.affiliate_payout_enabled = True
            else:
                affiliate.stripe_connect_account_status = 'pending'
                affiliate.affiliate_payout_enabled = False
        else:
            affiliate.stripe_connect_account_status = 'pending'
            affiliate.affiliate_payout_enabled = False
        
        db.commit()
        logger.info(f'✅ Status da conta Stripe Connect atualizado: {affiliate.email} - {affiliate.stripe_connect_account_status}')
        
    except Exception as e:
        db.rollback()
        logger.error(f'Erro ao processar account.updated: {str(e)}', exc_info=True)


