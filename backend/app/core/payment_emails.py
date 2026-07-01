"""
Aviso por email ao utilizador quando um pagamento de subscrição falha ("o teu pagamento falhou").

Antes desta alteração, uma falha de pagamento só era visível para quem abrisse a app (banner
+ notificação sintética). Se o utilizador não abrisse a app, não havia forma de saber — a
subscrição podia acabar suspensa sem aviso. Segue o mesmo padrão de envio do trial_emails.py
e do support_reply (background task disparada pelo webhook do Stripe).
"""
import logging

from fastapi_mail import FastMail, MessageSchema, MessageType

from .config import settings
from .dependencies import conf
from .email_translations import get_email_translation

logger = logging.getLogger(__name__)


def _build_payment_failed_html(tr: dict, reason: str, manage_url: str) -> str:
    """HTML simples e na linha visual da app (tema escuro)."""
    reason_html = (
        f'<p style="color:#f87171;font-size:14px;line-height:1.6;margin:0 0 16px;">'
        f'<strong>{tr.get("reason_label","")}</strong> {reason}</p>'
        if reason else ''
    )
    return f"""
    <div style="background:#0f172a;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:520px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
        <div style="padding:28px 32px 8px;">
          <h1 style="color:#fff;font-size:22px;margin:0 0 16px;">{tr.get('title','')}</h1>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin:0 0 16px;">{tr.get('message','')}</p>
          {reason_html}
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">{tr.get('cta_manage','')}</p>
          <a href="{manage_url}" style="display:inline-block;background:#ef4444;color:#fff;font-weight:bold;
             text-decoration:none;padding:12px 22px;border-radius:10px;font-size:15px;">{tr.get('button','')}</a>
        </div>
        <div style="padding:18px 32px;border-top:1px solid #1f2937;color:#475569;font-size:11px;text-align:center;">
          {tr.get('footer','')}
        </div>
      </div>
    </div>
    """


async def send_payment_failed_email(to_email: str, reason: str, language: str = 'pt') -> None:
    """Envia o email de aviso de falha de pagamento. Falhas de envio são apenas registadas."""
    try:
        lang = 'en' if (language or 'pt').lower().startswith('en') else 'pt'
        tr = get_email_translation(lang, 'payment_failed')
        manage_url = f"{settings.FRONTEND_URL}/billing"
        html = _build_payment_failed_html(tr, reason or '', manage_url)
        fm = FastMail(conf)
        await fm.send_message(MessageSchema(
            subject=tr.get('subject', 'Finly'),
            recipients=[to_email],
            body=html,
            subtype=MessageType.html,
        ))
        logger.info(f'[payment-failed-email] Enviado para {to_email}')
    except Exception as e:
        logger.warning(f'[payment-failed-email] Falha ao enviar para {to_email}: {e}')


def send_payment_failed_email_sync(to_email: str, reason: str, language: str = 'pt') -> None:
    """Wrapper síncrono para uso em BackgroundTasks (Starlette corre isto numa threadpool
    própria, sem loop ativo, por isso asyncio.run() aqui é seguro)."""
    import asyncio
    try:
        asyncio.run(send_payment_failed_email(to_email, reason, language))
    except Exception as e:
        logger.warning(f'[payment-failed-email] Falha no wrapper síncrono: {e}')
