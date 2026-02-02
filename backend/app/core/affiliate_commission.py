"""Comissões de afiliados por plano: Plus 20%, Pro 25%. Editável pelo admin via SystemSetting."""
from sqlalchemy.orm import Session
from ..models import database as models
from .config import settings

DEFAULT_PLUS_PERCENT = 20.0
DEFAULT_PRO_PERCENT = 25.0


def get_commission_percentage_for_price_id(price_id: str, db: Session) -> float:
    """
    Retorna a percentagem de comissão do afiliado para o price_id dado.
    Plus = 20% (editável), Pro = 25% (editável), Basic = 0%.
    Os afiliados ganham esta comissão em cada cobrança (mensal ou anual) enquanto o referido continuar subscrito.
    """
    if not price_id:
        return 0.0
    if price_id == settings.STRIPE_PRICE_PLUS:
        s = db.query(models.SystemSetting).filter(
            models.SystemSetting.key == 'affiliate_commission_percentage_plus'
        ).first()
        return float(s.value) if s and s.value else DEFAULT_PLUS_PERCENT
    if price_id == settings.STRIPE_PRICE_YEARLY:
        s = db.query(models.SystemSetting).filter(
            models.SystemSetting.key == 'affiliate_commission_percentage_pro'
        ).first()
        return float(s.value) if s and s.value else DEFAULT_PRO_PERCENT
    return 0.0  # Basic ou desconhecido
