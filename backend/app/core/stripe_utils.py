"""
Helpers partilhados de Stripe.

Centraliza lógica antes duplicada em routes/stripe.py, webhooks/stripe.py e routes/admin.py.
"""
import logging

import stripe

from .config import settings

logger = logging.getLogger(__name__)


def customer_has_saved_card(customer_id: str, subscription=None) -> bool:
    """
    True se houver um cartão associado.

    Verifica PRIMEIRO o default_payment_method da subscrição (definido pelo Checkout com
    payment_method_collection='always'); só depois o do customer. Isto evita falsos
    negativos quando o método ainda não propagou para o customer logo após o checkout,
    que marcariam um trial legítimo como 'incomplete' e retirariam acesso Pro indevidamente.
    """
    if subscription is not None:
        dpm = (
            subscription.get('default_payment_method')
            if isinstance(subscription, dict)
            else getattr(subscription, 'default_payment_method', None)
        )
        if dpm:
            return True

    if not customer_id or not settings.STRIPE_API_KEY:
        return False

    try:
        customer = stripe.Customer.retrieve(
            customer_id,
            expand=['invoice_settings.default_payment_method'],
        )
        invoice_settings = (
            customer.get('invoice_settings')
            if isinstance(customer, dict)
            else getattr(customer, 'invoice_settings', None)
        )
        default_pm = None
        if isinstance(invoice_settings, dict):
            default_pm = invoice_settings.get('default_payment_method')
        elif invoice_settings is not None:
            default_pm = getattr(invoice_settings, 'default_payment_method', None)
        if default_pm:
            return True

        cards = stripe.PaymentMethod.list(customer=customer_id, type='card', limit=1)
        return bool(getattr(cards, 'data', None))
    except stripe.error.InvalidRequestError:
        return False
    except Exception as e:
        logger.warning(f'Erro ao validar payment method do customer {customer_id}: {e}')
        return False
