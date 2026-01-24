"""
Utilitários para tracking de afiliados e prevenção de fraude
"""
from sqlalchemy.orm import Session
from ..models import database as models
from typing import Optional
import logging

logger = logging.getLogger(__name__)

def track_referral(
    db: Session,
    referred_user_id: str,
    affiliate_code: Optional[str],
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None
) -> Optional[models.Referral]:
    """
    Rastreia uma referência de afiliado quando um utilizador se regista.
    Protege contra fraude verificando se o utilizador não está a usar o próprio link.
    """
    if not affiliate_code:
        return None
    
    # Verificar se o sistema de afiliados está ativo
    settings = db.query(models.AffiliateSettings).first()
    if not settings or not settings.is_system_active:
        logger.info('Sistema de afiliados está desativado')
        return None
    
    # Encontrar o afiliado pelo código
    affiliate = db.query(models.Affiliate).filter(
        models.Affiliate.code == affiliate_code,
        models.Affiliate.is_active == True
    ).first()
    
    if not affiliate:
        logger.warning(f'Código de afiliado inválido: {affiliate_code}')
        return None
    
    # PROTEÇÃO CONTRA FRAUDE: Verificar se o utilizador não está a usar o próprio link
    referred_user = db.query(models.User).filter(models.User.id == referred_user_id).first()
    if referred_user and referred_user.id == affiliate.affiliate_id:
        logger.warning(f'Tentativa de auto-referência bloqueada: utilizador {referred_user.email} tentou usar o próprio link')
        return None
    
    # Verificar se já existe uma referência para este utilizador
    existing_referral = db.query(models.Referral).filter(
        models.Referral.referred_user_id == referred_user_id
    ).first()
    
    if existing_referral:
        logger.info(f'Referência já existe para utilizador {referred_user_id}')
        return existing_referral
    
    # Criar nova referência
    referral = models.Referral(
        affiliate_id=affiliate.id,
        referred_user_id=referred_user_id,
        ip_address=ip_address,
        user_agent=user_agent
    )
    
    db.add(referral)
    
    # Atualizar estatísticas do afiliado
    affiliate.total_referrals += 1
    
    # Atualizar campo referred_by_id no utilizador
    if referred_user:
        referred_user.referred_by_id = affiliate.affiliate_id
    
    db.commit()
    db.refresh(referral)
    
    logger.info(f'Nova referência criada: afiliado {affiliate.affiliate_id} -> utilizador {referred_user_id}')
    
    return referral

def track_conversion(
    db: Session,
    user_id: str,
    amount_cents: int
) -> Optional[models.Referral]:
    """
    Rastreia uma conversão (quando um utilizador referido paga Pro).
    Atualiza estatísticas e calcula comissões.
    """
    # Encontrar a referência
    referral = db.query(models.Referral).filter(
        models.Referral.referred_user_id == user_id,
        models.Referral.has_converted == False
    ).first()
    
    if not referral:
        return None
    
    # Verificar se já foi convertido
    if referral.has_converted:
        logger.info(f'Utilizador {user_id} já foi convertido anteriormente')
        return referral
    
    from datetime import datetime, timezone
    
    # Marcar como convertido
    referral.has_converted = True
    referral.conversion_date = datetime.now(timezone.utc)
    referral.conversion_amount_cents = amount_cents
    
    # Atualizar estatísticas do afiliado
    affiliate = db.query(models.Affiliate).filter(models.Affiliate.id == referral.affiliate_id).first()
    if affiliate:
        affiliate.total_conversions += 1
        
        # Calcular comissão
        commission_amount = int((amount_cents * float(affiliate.commission_percentage)) / 100)
        affiliate.total_earnings_cents += commission_amount
    
    db.commit()
    db.refresh(referral)
    
    logger.info(f'Conversão rastreada: utilizador {user_id} pagou {amount_cents} cêntimos, comissão: {commission_amount} cêntimos')
    
    return referral

def calculate_monthly_commissions(db: Session, month: int, year: int):
    """
    Calcula comissões mensais para todos os afiliados.
    Deve ser executado no fim de cada mês.
    """
    from datetime import datetime, timezone
    from sqlalchemy import and_, extract
    
    # Obter todas as referências convertidas no mês
    referrals = db.query(models.Referral).filter(
        and_(
            models.Referral.has_converted == True,
            extract('month', models.Referral.conversion_date) == month,
            extract('year', models.Referral.conversion_date) == year
        )
    ).all()
    
    # Agrupar por afiliado
    affiliate_data = {}
    for referral in referrals:
        affiliate_id = referral.affiliate_id
        if affiliate_id not in affiliate_data:
            affiliate_data[affiliate_id] = {
                'referrals': 0,
                'conversions': 0,
                'revenue_cents': 0
            }
        
        affiliate_data[affiliate_id]['referrals'] += 1
        if referral.has_converted:
            affiliate_data[affiliate_id]['conversions'] += 1
            affiliate_data[affiliate_id]['revenue_cents'] += referral.conversion_amount_cents or 0
    
    # Criar ou atualizar registos de comissão
    for affiliate_id, data in affiliate_data.items():
        affiliate = db.query(models.Affiliate).filter(models.Affiliate.id == affiliate_id).first()
        if not affiliate:
            continue
        
        # Verificar se já existe comissão para este mês
        commission = db.query(models.Commission).filter(
            and_(
                models.Commission.affiliate_id == affiliate_id,
                models.Commission.month == month,
                models.Commission.year == year
            )
        ).first()
        
        if commission:
            # Atualizar comissão existente
            commission.total_referrals = data['referrals']
            commission.total_conversions = data['conversions']
            commission.total_revenue_cents = data['revenue_cents']
            commission.commission_percentage = float(affiliate.commission_percentage)
            commission.commission_amount_cents = int((data['revenue_cents'] * float(affiliate.commission_percentage)) / 100)
        else:
            # Criar nova comissão
            commission = models.Commission(
                affiliate_id=affiliate_id,
                month=month,
                year=year,
                total_referrals=data['referrals'],
                total_conversions=data['conversions'],
                total_revenue_cents=data['revenue_cents'],
                commission_percentage=float(affiliate.commission_percentage),
                commission_amount_cents=int((data['revenue_cents'] * float(affiliate.commission_percentage)) / 100)
            )
            db.add(commission)
    
    db.commit()
    
    logger.info(f'Comissões mensais calculadas para {month}/{year}: {len(affiliate_data)} afiliados')

