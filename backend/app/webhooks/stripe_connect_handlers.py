"""Handlers para webhooks do Stripe Connect"""
from sqlalchemy.orm import Session
from uuid import UUID
from datetime import datetime, date
from ..models import database as models
import logging
import stripe

logger = logging.getLogger(__name__)


def handle_payment_intent_succeeded(payment_intent: dict, db: Session):
    """Processa payment_intent.succeeded - marca comissão como paga se houver transfer"""
    try:
        # Verificar se tem transfer_data (divisão automática)
        transfer_data = payment_intent.get('transfer_data')
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
        
        # Buscar metadata para identificar o cliente que pagou
        metadata = payment_intent.get('metadata', {})
        user_id_str = metadata.get('user_id')
        if not user_id_str:
            # Tentar buscar pelo customer
            customer_id = payment_intent.get('customer')
            if customer_id:
                user = db.query(models.User).filter(
                    models.User.stripe_customer_id == customer_id
                ).first()
                if user:
                    user_id_str = str(user.id)
        
        if not user_id_str:
            logger.warning(f'Não foi possível identificar o user_id do payment_intent {payment_intent.get("id")}')
            return
        
        # Buscar referral
        try:
            user_uuid = UUID(user_id_str)
        except ValueError:
            logger.error(f'user_id inválido: {user_id_str}')
            return
        
        referral = db.query(models.AffiliateReferral).filter(
            models.AffiliateReferral.referred_user_id == user_uuid,
            models.AffiliateReferral.referrer_id == affiliate.id
        ).first()
        
        if not referral:
            logger.warning(f'Referral não encontrada para user {user_id_str} e afiliado {affiliate.id}')
            return
        
        # Buscar comissão relacionada (ou criar se necessário)
        # Para divisão automática, a comissão é criada no momento do pagamento
        # Buscar comissão do mês atual
        current_month = date.today().replace(day=1)
        
        commission = db.query(models.AffiliateCommission).filter(
            models.AffiliateCommission.affiliate_id == affiliate.id,
            models.AffiliateCommission.month == current_month
        ).first()
        
        # Se não existe, criar (será calculada depois, mas marcamos como paga)
        if not commission:
            # Buscar percentagem de comissão
            commission_setting = db.query(models.SystemSetting).filter(
                models.SystemSetting.key == 'affiliate_commission_percentage'
            ).first()
            commission_percentage = float(commission_setting.value) if commission_setting else 20.0
            
            # Calcular comissão do pagamento atual
            amount = payment_intent.get('amount', 0)
            commission_amount = int(amount * (commission_percentage / 100))
            
            commission = models.AffiliateCommission(
                affiliate_id=affiliate.id,
                month=current_month,
                total_revenue_cents=amount,
                commission_percentage=float(commission_percentage),
                commission_amount_cents=commission_amount,
                referrals_count=1,
                conversions_count=1,
                is_paid=True,
                paid_at=datetime.now(),
                transfer_status='created'
            )
            db.add(commission)
        else:
            # Atualizar comissão existente
            if not commission.is_paid:
                commission.is_paid = True
                commission.paid_at = datetime.now()
                commission.transfer_status = 'created'
                # Atualizar valores se necessário
                amount = payment_intent.get('amount', 0)
                commission.total_revenue_cents += amount
                commission_setting = db.query(models.SystemSetting).filter(
                    models.SystemSetting.key == 'affiliate_commission_percentage'
                ).first()
                commission_percentage = float(commission_setting.value) if commission_setting else 20.0
                commission.commission_amount_cents += int(amount * (commission_percentage / 100))
                commission.conversions_count += 1
        
        db.commit()
        logger.info(f'✅ Comissão marcada como paga via divisão automática: afiliado {affiliate.email}, payment_intent {payment_intent.get("id")}')
        
    except Exception as e:
        db.rollback()
        logger.error(f'Erro ao processar payment_intent.succeeded: {str(e)}', exc_info=True)


def handle_transfer_created(transfer: dict, db: Session):
    """Processa transfer.created - captura stripe_transfer_id"""
    try:
        transfer_id = transfer.get('id')
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
        
        # Buscar comissão relacionada (mês atual)
        current_month = date.today().replace(day=1)
        
        commission = db.query(models.AffiliateCommission).filter(
            models.AffiliateCommission.affiliate_id == affiliate.id,
            models.AffiliateCommission.month == current_month,
            models.AffiliateCommission.stripe_transfer_id.is_(None)  # Ainda não tem transfer_id
        ).order_by(models.AffiliateCommission.created_at.desc()).first()
        
        if commission:
            commission.stripe_transfer_id = transfer_id
            commission.payment_reference = transfer_id
            db.commit()
            logger.info(f'✅ Transfer ID capturado: {transfer_id} para comissão {commission.id}')
        else:
            logger.warning(f'Comissão não encontrada para atualizar transfer_id {transfer_id}')
        
    except Exception as e:
        db.rollback()
        logger.error(f'Erro ao processar transfer.created: {str(e)}', exc_info=True)


def handle_transfer_reversed(transfer: dict, db: Session):
    """Processa transfer.reversed - reverte status da comissão"""
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

