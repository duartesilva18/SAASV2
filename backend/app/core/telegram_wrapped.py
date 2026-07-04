"""
"Wrapped" mensal — imagem partilhável (estilo Spotify Wrapped) enviada pelo bot no dia 1.

Gera um cartão vertical 1080×1920 (formato stories) com Pillow, sem serviços externos:
total gasto do mês, comparação com o mês anterior, top 3 categorias com barras,
nº de transações e maior gasto único. Branding Finly no rodapé.
"""
import io
import logging
import os
from datetime import date, timedelta

from PIL import Image, ImageDraw, ImageFont
from sqlalchemy import func

from ..models import database as models

logger = logging.getLogger(__name__)

# Paleta (alinhada com a app: slate escuro + azul/âmbar)
BG_TOP = (10, 15, 28)
BG_BOTTOM = (20, 30, 54)
WHITE = (241, 245, 249)
SLATE = (148, 163, 184)
SLATE_DIM = (100, 116, 139)
BLUE = (59, 130, 246)
EMERALD = (52, 211, 153)
RED = (248, 113, 113)
AMBER = (251, 191, 36)
BAR_BG = (30, 41, 59)
BAR_COLORS = [(59, 130, 246), (99, 102, 241), (245, 158, 11)]

W, H = 1080, 1920

_FONT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'assets', 'fonts')


def _font(size: int, bold: bool = False):
    name = 'DejaVuSans-Bold.ttf' if bold else 'DejaVuSans.ttf'
    try:
        return ImageFont.truetype(os.path.join(_FONT_DIR, name), size)
    except Exception:
        return ImageFont.load_default()


def _fmt_eur(cents: int, lang: str = 'pt') -> str:
    v = abs(int(cents)) / 100
    s = f"{v:,.2f}"
    if not (lang or 'pt').lower().startswith('en'):
        s = s.replace(',', ' ').replace('.', ',').replace(' ', '.')
    return s + "€"


MONTHS_PT = {1: 'Janeiro', 2: 'Fevereiro', 3: 'Março', 4: 'Abril', 5: 'Maio', 6: 'Junho',
             7: 'Julho', 8: 'Agosto', 9: 'Setembro', 10: 'Outubro', 11: 'Novembro', 12: 'Dezembro'}
MONTHS_EN = {1: 'January', 2: 'February', 3: 'March', 4: 'April', 5: 'May', 6: 'June',
             7: 'July', 8: 'August', 9: 'September', 10: 'October', 11: 'November', 12: 'December'}


def collect_month_stats(db, workspace_id, month_first: date) -> dict | None:
    """Estatísticas do mês [month_first .. fim do mês]. None se não houver transações."""
    next_first = (month_first.replace(day=28) + timedelta(days=4)).replace(day=1)
    month_last = next_first - timedelta(days=1)
    prev_first = (month_first - timedelta(days=1)).replace(day=1)
    prev_last = month_first - timedelta(days=1)

    def expenses_between(a, b):
        return int(db.query(
            func.coalesce(func.sum(func.abs(models.Transaction.amount_cents)), 0)
        ).filter(
            models.Transaction.workspace_id == workspace_id,
            models.Transaction.amount_cents < 0,
            models.Transaction.transaction_date >= a,
            models.Transaction.transaction_date <= b,
            func.abs(models.Transaction.amount_cents) != 1,
        ).scalar() or 0)

    total = expenses_between(month_first, month_last)
    tx_count = int(db.query(func.count(models.Transaction.id)).filter(
        models.Transaction.workspace_id == workspace_id,
        models.Transaction.transaction_date >= month_first,
        models.Transaction.transaction_date <= month_last,
        func.abs(models.Transaction.amount_cents) != 1,
    ).scalar() or 0)
    if tx_count == 0:
        return None

    prev_total = expenses_between(prev_first, prev_last)

    top_cats = db.query(
        models.Category.name,
        func.sum(func.abs(models.Transaction.amount_cents)).label('total'),
    ).join(models.Category, models.Transaction.category_id == models.Category.id).filter(
        models.Transaction.workspace_id == workspace_id,
        models.Transaction.amount_cents < 0,
        models.Transaction.transaction_date >= month_first,
        models.Transaction.transaction_date <= month_last,
        func.abs(models.Transaction.amount_cents) != 1,
        models.Category.vault_type == 'none',
    ).group_by(models.Category.name).order_by(func.sum(func.abs(models.Transaction.amount_cents)).desc()).limit(3).all()

    biggest = db.query(models.Transaction.description, func.abs(models.Transaction.amount_cents)).filter(
        models.Transaction.workspace_id == workspace_id,
        models.Transaction.amount_cents < 0,
        models.Transaction.transaction_date >= month_first,
        models.Transaction.transaction_date <= month_last,
        func.abs(models.Transaction.amount_cents) != 1,
    ).order_by(func.abs(models.Transaction.amount_cents).desc()).first()

    return {
        'month_first': month_first,
        'total_cents': total,
        'prev_total_cents': prev_total,
        'tx_count': tx_count,
        'top_categories': [(name, int(t)) for name, t in top_cats],
        'biggest': (biggest[0], int(biggest[1])) if biggest else None,
    }


def render_wrapped_image(stats: dict, lang: str = 'pt') -> bytes:
    """Desenha o cartão 1080×1920 e devolve PNG em bytes."""
    is_en = (lang or 'pt').lower().startswith('en')
    months = MONTHS_EN if is_en else MONTHS_PT
    m = stats['month_first']

    img = Image.new('RGB', (W, H), BG_TOP)
    draw = ImageDraw.Draw(img)
    # Gradiente vertical simples
    for y in range(H):
        f = y / H
        draw.line([(0, y), (W, y)], fill=tuple(int(a + (b - a) * f) for a, b in zip(BG_TOP, BG_BOTTOM)))

    # Header
    draw.text((80, 110), "FINLY", font=_font(56, bold=True), fill=BLUE)
    title = "Your month in numbers" if is_en else "O teu mês em números"
    draw.text((80, 200), title, font=_font(44), fill=SLATE)
    draw.text((80, 270), f"{months[m.month]} {m.year}", font=_font(72, bold=True), fill=WHITE)

    # Total gasto
    y = 470
    draw.text((80, y), "TOTAL GASTO" if not is_en else "TOTAL SPENT", font=_font(34, bold=True), fill=SLATE_DIM)
    draw.text((80, y + 55), _fmt_eur(stats['total_cents'], lang), font=_font(130, bold=True), fill=WHITE)

    # Comparação com mês anterior
    y = 720
    prev = stats['prev_total_cents']
    if prev > 0:
        pct = round((stats['total_cents'] - prev) / prev * 100)
        if pct <= -1:
            comp = (f"▼ {abs(pct)}% less than last month" if is_en else f"▼ {abs(pct)}% menos que o mês anterior")
            color = EMERALD
        elif pct >= 1:
            comp = (f"▲ {pct}% more than last month" if is_en else f"▲ {pct}% mais que o mês anterior")
            color = RED
        else:
            comp = ("≈ same as last month" if is_en else "≈ igual ao mês anterior")
            color = SLATE
        draw.text((80, y), comp, font=_font(44, bold=True), fill=color)
        y += 90

    # Top categorias com barras
    y = max(y, 830) + 40
    draw.text((80, y), "TOP CATEGORIAS" if not is_en else "TOP CATEGORIES", font=_font(34, bold=True), fill=SLATE_DIM)
    y += 70
    top = stats['top_categories']
    max_val = top[0][1] if top else 1
    for i, (name, cents) in enumerate(top):
        display = name if len(name) <= 22 else name[:21] + '…'
        draw.text((80, y), f"{i + 1}. {display}", font=_font(42, bold=True), fill=WHITE)
        val_txt = _fmt_eur(cents, lang)
        vw = draw.textlength(val_txt, font=_font(42, bold=True))
        draw.text((W - 80 - vw, y), val_txt, font=_font(42, bold=True), fill=SLATE)
        bar_y = y + 62
        bar_w_total = W - 160
        draw.rounded_rectangle([80, bar_y, 80 + bar_w_total, bar_y + 22], radius=11, fill=BAR_BG)
        frac = max(cents / max_val, 0.06)
        draw.rounded_rectangle([80, bar_y, 80 + int(bar_w_total * frac), bar_y + 22], radius=11, fill=BAR_COLORS[i % 3])
        y += 135

    # Extras: nº transações + maior gasto
    y += 40
    draw.line([(80, y), (W - 80, y)], fill=BAR_BG, width=3)
    y += 50
    draw.text((80, y), ("TRANSACTIONS" if is_en else "TRANSAÇÕES"), font=_font(30, bold=True), fill=SLATE_DIM)
    draw.text((80, y + 45), str(stats['tx_count']), font=_font(64, bold=True), fill=WHITE)
    if stats.get('biggest'):
        bdesc, bcents = stats['biggest']
        bdesc = bdesc if len(bdesc) <= 18 else bdesc[:17] + '…'
        draw.text((540, y), ("BIGGEST EXPENSE" if is_en else "MAIOR GASTO"), font=_font(30, bold=True), fill=SLATE_DIM)
        draw.text((540, y + 45), _fmt_eur(bcents, lang), font=_font(64, bold=True), fill=AMBER)
        draw.text((540, y + 125), bdesc, font=_font(36), fill=SLATE)

    # Rodapé branding
    footer_y = H - 170
    draw.line([(80, footer_y - 40), (W - 80, footer_y - 40)], fill=BAR_BG, width=3)
    draw.text((80, footer_y), "finlybot.com", font=_font(44, bold=True), fill=BLUE)
    tag = "Track spending in 5 seconds on Telegram" if is_en else "Regista gastos em 5 segundos no Telegram"
    draw.text((80, footer_y + 65), tag, font=_font(32), fill=SLATE_DIM)

    buf = io.BytesIO()
    img.save(buf, format='PNG', optimize=True)
    return buf.getvalue()
