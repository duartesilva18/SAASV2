"""Comissões de afiliados por plano: Basic e Plus 20%, Pro 25%. Editável pelo admin via SystemSetting."""
from sqlalchemy.orm import Session
from ..models import database as models
from .config import settings

DEFAULT_PLUS_PERCENT = 20.0
DEFAULT_PRO_PERCENT = 25.0


def _get_plus_commission(db: Session) -> float:
    s = db.query(models.SystemSetting).filter(
        models.SystemSetting.key == 'affiliate_commission_percentage_plus'
    ).first()
    return float(s.value) if s and s.value else DEFAULT_PLUS_PERCENT


def get_commission_percentage_for_price_id(price_id: str, db: Session) -> float:
    """
    Retorna a percentagem de comissão do afiliado para o price_id dado.
    Basic e Plus = 20% (editável), Pro = 25% (editável).
    Qualquer outro price_id pago usa 25% por defeito.
    """
    if not price_id:
        return 0.0
    if price_id == getattr(settings, 'STRIPE_PRICE_BASIC_MONTHLY', ''):
        return _get_plus_commission(db)  # Basic = mesma % que Plus (20%)
    if price_id == settings.STRIPE_PRICE_PLUS:
        return _get_plus_commission(db)
    if price_id == settings.STRIPE_PRICE_YEARLY:
        s = db.query(models.SystemSetting).filter(
            models.SystemSetting.key == 'affiliate_commission_percentage_pro'
        ).first()
        return float(s.value) if s and s.value else DEFAULT_PRO_PERCENT
    # Qualquer outro plano pago (ex: Pro mensal com outro price_id) → 25% por defeito
    return DEFAULT_PRO_PERCENT
