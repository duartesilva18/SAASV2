"""
Aviso por email de fim de período grátis ("o teu trial acaba amanhã").

Estratégia: um job diário procura utilizadores em 'trialing' que ainda não receberam o
aviso, confirma no Stripe quando termina o trial (trial_end) e, se for dentro da janela
(por defeito ~32h), envia o email e marca trial_ending_email_sent=True (deduplicação).
"""
import logging
from datetime import datetime, timezone, timedelta

import stripe
from sqlalchemy.orm import Session
from fastapi_mail import FastMail, MessageSchema, MessageType

from .config import settings
from .dependencies import conf
from .email_translations import get_email_translation
from ..models import database as models

logger = logging.getLogger(__name__)


def _build_trial_ending_html(tr: dict, manage_url: str) -> str:
    """HTML simples e na linha visual da app (tema escuro)."""
    return f"""
    <div style="background:#0f172a;padding:32px 0;font-family:Arial,Helvetica,sans-serif;">
      <div style="max-width:520px;margin:0 auto;background:#111827;border:1px solid #1f2937;border-radius:16px;overflow:hidden;">
        <div style="padding:28px 32px 8px;">
          <h1 style="color:#fff;font-size:22px;margin:0 0 16px;">{tr.get('title','')}</h1>
          <p style="color:#cbd5e1;font-size:15px;line-height:1.6;margin:0 0 16px;">{tr.get('message','')}</p>
          <p style="color:#34d399;font-size:14px;line-height:1.6;margin:0 0 20px;">{tr.get('cta_continue','')}</p>
          <p style="color:#94a3b8;font-size:14px;line-height:1.6;margin:0 0 20px;">{tr.get('cta_manage','')}</p>
          <a href="{manage_url}" style="display:inline-block;background:#10b981;color:#04210f;font-weight:bold;
             text-decoration:none;padding:12px 22px;border-radius:10px;font-size:15px;">{tr.get('button','')}</a>
          <p style="color:#64748b;font-size:12px;line-height:1.6;margin:24px 0 0;">{tr.get('security_notice','')}</p>
        </div>
        <div style="padding:18px 32px;border-top:1px solid #1f2937;color:#475569;font-size:11px;text-align:center;">
          {tr.get('footer','')}
        </div>
      </div>
    </div>
    """


async def send_trial_ending_emails(db: Session, window_hours: int = 32, limit: int = 200) -> dict:
    """
    Envia o aviso de fim de trial aos utilizadores cujo trial termina dentro de `window_hours`.
    Idempotente (flag trial_ending_email_sent). Processa cada utilizador isoladamente.
    """
    if not settings.STRIPE_API_KEY:
        logger.info('[trial-email] STRIPE_API_KEY ausente; envio ignorado.')
        return {'checked': 0, 'sent': 0}

    now = datetime.now(timezone.utc)
    users = (
        db.query(models.User)
        .filter(
            models.User.subscription_status == 'trialing',
            models.User.stripe_subscription_id.isnot(None),
            models.User.trial_ending_email_sent.is_(False),
        )
        .limit(limit)
        .all()
    )

    fm = FastMail(conf)
    sent = 0
    for user in users:
        try:
            subscription = stripe.Subscription.retrieve(user.stripe_subscription_id)
        except Exception as e:
            logger.warning(f'[trial-email] Falha ao obter subscrição de {user.email}: {e}')
            continue

        trial_end = getattr(subscription, 'trial_end', None)
        sub_status = getattr(subscription, 'status', None)
        if sub_status != 'trialing' or not trial_end:
            continue
        trial_end_dt = datetime.fromtimestamp(trial_end, tz=timezone.utc)
        # Só avisar quando o fim está próximo (entre agora e now+window_hours).
        if not (now <= trial_end_dt <= now + timedelta(hours=window_hours)):
            continue

        lang = (getattr(user, 'language', None) or 'pt').lower()
        tr = get_email_translation('en' if lang.startswith('en') else 'pt', 'trial_ending')
        manage_url = f"{settings.FRONTEND_URL}/settings"
        html = _build_trial_ending_html(tr, manage_url)
        try:
            await fm.send_message(MessageSchema(
                subject=tr.get('subject', 'Finly'),
                recipients=[user.email],
                body=html,
                subtype=MessageType.html,
            ))
            user.trial_ending_email_sent = True
            db.commit()
            sent += 1
            logger.info(f'[trial-email] Aviso de fim de trial enviado para {user.email}')
        except Exception as e:
            db.rollback()
            logger.warning(f'[trial-email] Falha ao enviar para {user.email}: {e}')

    logger.info(f'[trial-email] Concluído: {len(users)} candidatos, {sent} enviados.')
    return {'checked': len(users), 'sent': sent}
