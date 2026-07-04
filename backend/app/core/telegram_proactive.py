"""
Notificações proativas do bot Telegram — o bot fala primeiro.

Corre num job diário (APScheduler em main.py). Decide, por utilizador com Telegram
ligado, se há algo que valha a pena dizer:
  - Domingo: resumo da semana vs. semana anterior.
  - Dia 15: ritmo dos orçamentos — "a este ritmo estouras X por volta do dia Y".

Regras anti-spam:
  - Só utilizadores com atividade nos últimos 45 dias (senão é ruído para contas mortas).
  - Opt-out via /alertas (SystemSetting key 'tgpo:<user_id>').
  - Dedup por AuditLog (action='tg_proactive'): cada tipo só é enviado uma vez por período,
    mesmo que o job corra mais de uma vez ou o processo reinicie.
"""
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, case

from ..models import database as models

logger = logging.getLogger(__name__)

ACTIVITY_WINDOW_DAYS = 45
MAX_PACE_LINES = 2  # no máximo 2 categorias no aviso de ritmo (senão vira parede de texto)


def _optout_key(user_id) -> str:
    return f"tgpo:{user_id}"


def is_proactive_disabled(db, user_id) -> bool:
    row = db.query(models.SystemSetting).filter(models.SystemSetting.key == _optout_key(user_id)).first()
    return bool(row and (row.value or '').strip() == '1')


def set_proactive_disabled(db, user_id, disabled: bool) -> None:
    """Liga/desliga os alertas proativos para um utilizador (usado pelo comando /alertas)."""
    row = db.query(models.SystemSetting).filter(models.SystemSetting.key == _optout_key(user_id)).first()
    if disabled:
        if row:
            row.value = '1'
        else:
            db.add(models.SystemSetting(key=_optout_key(user_id), value='1', description='Alertas proativos Telegram desligados'))
    elif row:
        db.delete(row)
    db.commit()


def _already_sent(db, user_id, period_key: str) -> bool:
    return db.query(models.AuditLog.id).filter(
        models.AuditLog.user_id == user_id,
        models.AuditLog.action == 'tg_proactive',
        models.AuditLog.details == period_key,
    ).first() is not None


def _mark_sent(db, user_id, period_key: str) -> None:
    db.add(models.AuditLog(user_id=user_id, action='tg_proactive', details=period_key))
    db.commit()


def _week_expenses_cents(db, workspace_id, start: date, end: date) -> int:
    total = db.query(
        func.coalesce(func.sum(case((models.Transaction.amount_cents < 0, func.abs(models.Transaction.amount_cents)), else_=0)), 0)
    ).filter(
        models.Transaction.workspace_id == workspace_id,
        models.Transaction.transaction_date >= start,
        models.Transaction.transaction_date <= end,
        func.abs(models.Transaction.amount_cents) != 1,  # excluir seed
    ).scalar()
    return int(total or 0)


def _weekly_summary_message(db, user, workspace, t, fmt) -> str | None:
    """Resumo de domingo: esta semana vs. anterior. None se não houver nada que valha a pena."""
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    this_week = _week_expenses_cents(db, workspace.id, week_start, today)
    prev_start = week_start - timedelta(days=7)
    prev_end = week_start - timedelta(days=1)
    prev_week = _week_expenses_cents(db, workspace.id, prev_start, prev_end)

    if this_week == 0 and prev_week == 0:
        return None  # semanas mortas: não há nada para dizer

    amount = fmt(this_week, user.language or 'pt')
    if prev_week <= 0:
        return t('proactive_week_first').format(amount=amount)
    diff_pct = round((this_week - prev_week) / prev_week * 100)
    if diff_pct <= -3:
        return t('proactive_week_down').format(amount=amount, percent=abs(diff_pct))
    if diff_pct >= 3:
        return t('proactive_week_up').format(amount=amount, percent=diff_pct)
    return t('proactive_week_flat').format(amount=amount)


def _budget_pace_message(db, user, workspace, t, fmt) -> str | None:
    """Dia 15: para categorias com limite mensal, projeta o gasto e avisa se vai estourar."""
    today = date.today()
    day = today.day
    if day < 2:
        return None
    # dias no mês corrente
    next_month = (today.replace(day=28) + timedelta(days=4)).replace(day=1)
    days_in_month = (next_month - timedelta(days=1)).day
    first_day = today.replace(day=1)

    cats = db.query(models.Category).filter(
        models.Category.workspace_id == workspace.id,
        models.Category.type == 'expense',
        models.Category.monthly_limit_cents > 0,
    ).all()
    if not cats:
        return None

    lines = []
    for cat in cats:
        spent = db.query(
            func.coalesce(func.sum(func.abs(models.Transaction.amount_cents)), 0)
        ).filter(
            models.Transaction.workspace_id == workspace.id,
            models.Transaction.category_id == cat.id,
            models.Transaction.amount_cents < 0,
            models.Transaction.transaction_date >= first_day,
            models.Transaction.transaction_date <= today,
            func.abs(models.Transaction.amount_cents) != 1,
        ).scalar() or 0
        spent = int(spent)
        if spent <= 0:
            continue
        daily_rate = spent / day
        projected = daily_rate * days_in_month
        if projected > cat.monthly_limit_cents:
            overrun_day = min(days_in_month, int(cat.monthly_limit_cents / daily_rate) + 1)
            if overrun_day <= day:
                continue  # já estourou — o alerta de orçamento normal trata disso na próxima transação
            lines.append((projected - cat.monthly_limit_cents, t('proactive_pace_line').format(
                category=cat.name,
                day=overrun_day,
                spent=fmt(spent, user.language or 'pt'),
                limit=fmt(cat.monthly_limit_cents, user.language or 'pt'),
            )))
    if not lines:
        return None
    lines.sort(key=lambda x: -x[0])  # piores primeiro
    body = "".join(line for _, line in lines[:MAX_PACE_LINES])
    return t('proactive_pace_header') + body + t('proactive_pace_footer')


def run_proactive_notifications(db) -> dict:
    """Percorre os utilizadores com Telegram ligado e envia o que houver para dizer hoje."""
    # Imports tardios para evitar ciclo (telegram.py importa muita coisa)
    from ..webhooks.telegram import send_telegram_msg, _format_amount_for_lang
    from .telegram_translations import get_telegram_t

    today = date.today()
    is_sunday = today.weekday() == 6
    is_mid_month = today.day == 15
    if not (is_sunday or is_mid_month):
        return {'sent': 0, 'skipped': 'nothing scheduled today'}

    def fmt(cents: int, lang: str) -> str:
        return _format_amount_for_lang(cents, lang)

    cutoff = datetime.now(timezone.utc) - timedelta(days=ACTIVITY_WINDOW_DAYS)
    users = db.query(models.User).filter(models.User.phone_number.isnot(None)).all()
    sent = 0
    for user in users:
        try:
            # phone_number só é um chat_id do Telegram depois da associação (valor numérico);
            # "+351..." vem do onboarding e significa que o bot NÃO está ligado
            chat_id = (user.phone_number or '').strip()
            if not chat_id.isdigit():
                continue
            if is_proactive_disabled(db, user.id):
                continue
            workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == user.id).first()
            if not workspace:
                continue
            # Gate de atividade: sem transações recentes, não incomodar
            recent = db.query(models.Transaction.id).filter(
                models.Transaction.workspace_id == workspace.id,
                models.Transaction.created_at >= cutoff,
            ).first()
            if not recent:
                continue

            t = get_telegram_t(user.language or 'pt')
            messages = []
            if is_sunday:
                key = f"weekly:{today.isocalendar().year}-W{today.isocalendar().week:02d}"
                if not _already_sent(db, user.id, key):
                    msg = _weekly_summary_message(db, user, workspace, t, fmt)
                    if msg:
                        messages.append((key, msg))
            if is_mid_month:
                key = f"pace:{today.strftime('%Y-%m')}"
                if not _already_sent(db, user.id, key):
                    msg = _budget_pace_message(db, user, workspace, t, fmt)
                    if msg:
                        messages.append((key, msg))

            for key, msg in messages:
                send_telegram_msg(chat_id, msg)
                _mark_sent(db, user.id, key)
                sent += 1
        except Exception as e:
            logger.warning("Proativo falhou para %s: %s", user.email, e)
            db.rollback()

    return {'sent': sent, 'users_checked': len(users)}
