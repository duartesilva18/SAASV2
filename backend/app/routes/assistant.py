"""
Copiloto IA Financeiro – chat conversacional com contexto financeiro real.
Usa OpenAI GPT-4o com streaming (SSE) e dados do FinancialEngine.
"""
import json
import logging
from datetime import datetime, timedelta, date
from collections import defaultdict
from typing import List, Optional
from uuid import UUID as _UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, Field

from ..core.dependencies import get_db
from ..core.config import settings
from ..core.financial_engine import FinancialEngine
from ..core.limiter import limiter
from ..models import database as models
from .auth import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix='/assistant', tags=['assistant'])


class ChatMessage(BaseModel):
    role: str = Field(..., pattern='^(user|assistant)$')
    content: str


class ChatRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=2000)
    history: List[ChatMessage] = Field(default_factory=list, max_length=20)


def _build_financial_context(db: Session, user: models.User, workspace: models.Workspace) -> str:
    """Recolhe dados financeiros agregados e devolve como texto estruturado para o system prompt."""
    now = datetime.now()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (this_month_start - timedelta(days=1)).replace(day=1)
    six_months_ago = now - timedelta(days=180)

    categories = db.query(models.Category).filter(
        models.Category.workspace_id == workspace.id
    ).all()
    cat_map = {c.id: c for c in categories}

    all_txs = db.query(models.Transaction).filter(
        models.Transaction.workspace_id == workspace.id,
        models.Transaction.transaction_date >= six_months_ago.date(),
        func.abs(models.Transaction.amount_cents) != 1,
    ).order_by(models.Transaction.transaction_date.desc()).limit(3000).all()

    this_month_txs = [t for t in all_txs if t.transaction_date >= this_month_start.date()]
    last_month_txs = [t for t in all_txs if last_month_start.date() <= t.transaction_date < this_month_start.date()]

    snapshot_this = FinancialEngine.calculate_snapshot(this_month_txs, categories, workspace,
                                                       period_start=this_month_start.date(),
                                                       period_end=now.date())
    snapshot_last = FinancialEngine.calculate_snapshot(last_month_txs, categories, workspace,
                                                       period_start=last_month_start.date(),
                                                       period_end=(this_month_start - timedelta(days=1)).date())

    monthly_data = defaultdict(lambda: {'income': 0.0, 'expenses': 0.0, 'by_cat': defaultdict(float)})
    for t in all_txs:
        mk = t.transaction_date.strftime('%Y-%m')
        cat = cat_map.get(t.category_id)
        if not cat:
            monthly_data[mk]['expenses'] += abs(t.amount_cents / 100)
            continue
        if cat.vault_type != 'none':
            continue
        amt = abs(t.amount_cents / 100)
        if cat.type == 'income':
            monthly_data[mk]['income'] += amt
        else:
            monthly_data[mk]['expenses'] += amt
            monthly_data[mk]['by_cat'][cat.name] += amt

    top_cats_this = []
    for cid_str, val in snapshot_this.category_totals.items():
        try:
            cid = _UUID(cid_str)
        except ValueError:
            continue
        cat = cat_map.get(cid)
        if cat and cat.type == 'expense':
            top_cats_this.append((cat.name, abs(val)))
    top_cats_this.sort(key=lambda x: x[1], reverse=True)
    top_cats_this = top_cats_this[:8]

    recurring = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.workspace_id == workspace.id,
        models.RecurringTransaction.is_active == True,
    ).all()

    goals = db.query(models.SavingsGoal).filter(
        models.SavingsGoal.workspace_id == workspace.id,
    ).all()

    cat_limits = [(c.name, c.monthly_limit_cents / 100) for c in categories
                  if c.type == 'expense' and c.monthly_limit_cents > 0]

    recent_txs = this_month_txs[:15]
    recent_lines = []
    for t in recent_txs:
        cat = cat_map.get(t.category_id)
        cat_name = cat.name if cat else '?'
        sign = '+' if (cat and cat.type == 'income') else '-'
        recent_lines.append(f"  {t.transaction_date} | {sign}{abs(t.amount_cents/100):.2f} | {cat_name} | {t.description or ''}")

    monthly_summary = []
    for mk in sorted(monthly_data.keys(), reverse=True)[:6]:
        d = monthly_data[mk]
        monthly_summary.append(f"  {mk}: Rendimento={d['income']:.0f}, Despesas={d['expenses']:.0f}, Top={', '.join(f'{k}:{v:.0f}' for k, v in sorted(d['by_cat'].items(), key=lambda x: x[1], reverse=True)[:4])}")

    currency = user.currency or 'EUR'
    lines = [
        f"MOEDA: {currency}",
        f"DATA ATUAL: {now.strftime('%Y-%m-%d')}",
        "",
        "== ESTE MÊS ==",
        f"Rendimento: {snapshot_this.income:.2f}",
        f"Despesas: {snapshot_this.expenses:.2f}",
        f"Cofre (emergência): {snapshot_this.vault_emergency:.2f}",
        f"Cofre (investimento): {snapshot_this.vault_investment:.2f}",
        f"Cash disponível: {snapshot_this.available_cash:.2f}",
        f"Taxa de poupança: {snapshot_this.saving_rate:.1f}%",
        f"Transações: {snapshot_this.transaction_count}",
        "",
        "== MÊS ANTERIOR ==",
        f"Rendimento: {snapshot_last.income:.2f}",
        f"Despesas: {snapshot_last.expenses:.2f}",
        f"Taxa de poupança: {snapshot_last.saving_rate:.1f}%",
        "",
        "== TOP CATEGORIAS (este mês) ==",
    ]
    for name, val in top_cats_this:
        lines.append(f"  {name}: {val:.2f}")

    if cat_limits:
        lines.append("")
        lines.append("== LIMITES DE CATEGORIAS ==")
        for name, limit in cat_limits:
            spent = next((v for n, v in top_cats_this if n == name), 0)
            pct = (spent / limit * 100) if limit > 0 else 0
            lines.append(f"  {name}: limite={limit:.0f}, gasto={spent:.0f} ({pct:.0f}%)")

    if recurring:
        lines.append("")
        lines.append("== SUBSCRIÇÕES/RECORRENTES ==")
        for r in recurring:
            cat = cat_map.get(r.category_id)
            lines.append(f"  Dia {r.day_of_month}: {r.description} = {abs(r.amount_cents/100):.2f} ({cat.name if cat else '?'})")

    if goals:
        lines.append("")
        lines.append("== METAS DE POUPANÇA ==")
        for g in goals:
            pct = (g.current_amount_cents / g.target_amount_cents * 100) if g.target_amount_cents > 0 else 0
            lines.append(f"  {g.name}: {g.current_amount_cents/100:.0f}/{g.target_amount_cents/100:.0f} ({pct:.0f}%) - objetivo: {g.target_date}")

    lines.append("")
    lines.append("== RESUMO MENSAL (6 meses) ==")
    lines.extend(monthly_summary)

    if recent_lines:
        lines.append("")
        lines.append("== TRANSAÇÕES RECENTES ==")
        lines.extend(recent_lines)

    return "\n".join(lines)


def _get_system_prompt(user: models.User, financial_context: str, lang: str) -> str:
    name = user.full_name or user.email.split('@')[0]
    currency = user.currency or 'EUR'

    if lang.startswith('en'):
        return f"""You are Finly AI, the personal financial copilot of {name}.
You have access to their real financial data below. Answer questions accurately using this data.
Always respond in English. Currency: {currency}.

When a chart/graph would help illustrate the answer, include a JSON block between [CHART] and [/CHART] tags with this structure:
{{"type": "bar"|"pie"|"line"|"comparison", "title": "Chart title", "data": [{{"label": "Name", "value": 123}}]}}
Only include charts when they genuinely add value. Not every answer needs a chart.

Rules:
- Never invent or fabricate numbers. Only use the data provided.
- If data is insufficient, say so honestly.
- Be concise but helpful. Use bullet points for clarity.
- When giving financial advice, be practical and specific to their situation.
- You can do calculations and projections based on the data.
- For "can I afford X?" questions, consider their available cash, monthly surplus, and existing commitments.

FINANCIAL DATA:
{financial_context}"""
    elif lang.startswith('fr'):
        return f"""Tu es Finly AI, le copilote financier personnel de {name}.
Tu as accès à leurs données financières réelles ci-dessous. Réponds aux questions avec précision en utilisant ces données.
Réponds toujours en français. Devise: {currency}.

Quand un graphique aiderait à illustrer la réponse, inclus un bloc JSON entre les balises [CHART] et [/CHART] avec cette structure:
{{"type": "bar"|"pie"|"line"|"comparison", "title": "Titre du graphique", "data": [{{"label": "Nom", "value": 123}}]}}
N'inclus des graphiques que quand ils apportent vraiment de la valeur.

Règles:
- N'invente jamais de chiffres. Utilise uniquement les données fournies.
- Si les données sont insuffisantes, dis-le honnêtement.
- Sois concis mais utile. Utilise des puces pour la clarté.
- Pour les conseils financiers, sois pratique et spécifique à leur situation.
- Tu peux faire des calculs et des projections basés sur les données.

DONNÉES FINANCIÈRES:
{financial_context}"""
    else:
        return f"""Tu és o Finly AI, o copiloto financeiro pessoal de {name}.
Tens acesso aos dados financeiros reais abaixo. Responde às perguntas com precisão usando estes dados.
Responde sempre em português. Moeda: {currency}.

Quando um gráfico ajudar a ilustrar a resposta, inclui um bloco JSON entre tags [CHART] e [/CHART] com esta estrutura:
{{"type": "bar"|"pie"|"line"|"comparison", "title": "Título do gráfico", "data": [{{"label": "Nome", "value": 123}}]}}
Só inclui gráficos quando realmente acrescentam valor. Nem toda a resposta precisa de gráfico.

Regras:
- Nunca inventes números. Usa apenas os dados fornecidos.
- Se os dados forem insuficientes, diz isso honestamente.
- Sê conciso mas útil. Usa bullet points para clareza.
- Quando deres conselhos financeiros, sê prático e específico para a situação dele/dela.
- Podes fazer cálculos e projeções baseados nos dados.
- Para perguntas "posso comprar X?", considera o cash disponível, excedente mensal e compromissos existentes.

DADOS FINANCEIROS:
{financial_context}"""


@router.post('/chat')
@limiter.limit('30/hour')
async def assistant_chat(
    body: ChatRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail='Pro subscription required')

    if not getattr(settings, 'OPENAI_API_KEY', None):
        raise HTTPException(status_code=503, detail='AI service not configured')

    workspace = db.query(models.Workspace).filter(
        models.Workspace.owner_id == current_user.id
    ).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')

    header_lang = (request.headers.get('accept-language') or '').lower()
    user_lang = (getattr(current_user, 'language', None) or 'pt').lower()
    lang = header_lang or user_lang

    financial_context = _build_financial_context(db, current_user, workspace)
    system_prompt = _get_system_prompt(current_user, financial_context, lang)

    messages = [{"role": "system", "content": system_prompt}]
    for msg in body.history[-10:]:
        messages.append({"role": msg.role, "content": msg.content})
    messages.append({"role": "user", "content": body.message})

    from openai import OpenAI
    client = OpenAI(api_key=settings.OPENAI_API_KEY)

    def generate():
        try:
            stream = client.chat.completions.create(
                model="gpt-4o",
                messages=messages,
                max_tokens=1500,
                temperature=0.7,
                stream=True,
            )
            for chunk in stream:
                delta = chunk.choices[0].delta if chunk.choices else None
                if delta and delta.content:
                    data = json.dumps({"type": "token", "content": delta.content}, ensure_ascii=False)
                    yield f"data: {data}\n\n"

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            logger.error(f"OpenAI streaming error: {e}")
            error_data = json.dumps({"type": "error", "content": str(e)}, ensure_ascii=False)
            yield f"data: {error_data}\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream", headers={
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
        "X-Accel-Buffering": "no",
    })


@router.get('/suggestions')
async def get_suggestions(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail='Pro subscription required')

    workspace = db.query(models.Workspace).filter(
        models.Workspace.owner_id == current_user.id
    ).first()
    if not workspace:
        return {"suggestions": []}

    header_lang = (request.headers.get('accept-language') or '').lower()
    user_lang = (getattr(current_user, 'language', None) or 'pt').lower()
    lang = header_lang or user_lang

    now = datetime.now()
    this_month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    tx_count = db.query(func.count(models.Transaction.id)).filter(
        models.Transaction.workspace_id == workspace.id,
        models.Transaction.transaction_date >= this_month_start.date(),
        func.abs(models.Transaction.amount_cents) != 1,
    ).scalar() or 0

    goals = db.query(models.SavingsGoal).filter(
        models.SavingsGoal.workspace_id == workspace.id,
    ).all()

    recurring = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.workspace_id == workspace.id,
        models.RecurringTransaction.is_active == True,
    ).count()

    is_en = lang.startswith('en')
    is_fr = lang.startswith('fr')

    suggestions = []

    if is_en:
        suggestions.append("How am I doing financially this month?")
        if tx_count > 5:
            suggestions.append("Where can I cut expenses?")
            suggestions.append("Compare this month with last month")
        suggestions.append("What's my savings rate?")
        if goals:
            suggestions.append(f"When will I reach my goal \"{goals[0].name}\"?")
        if recurring > 0:
            suggestions.append("How much do I spend on subscriptions?")
        suggestions.append("Can I afford a purchase of 500€?")
    elif is_fr:
        suggestions.append("Comment je m'en sors financièrement ce mois-ci?")
        if tx_count > 5:
            suggestions.append("Où puis-je réduire mes dépenses?")
            suggestions.append("Compare ce mois avec le mois dernier")
        suggestions.append("Quel est mon taux d'épargne?")
        if goals:
            suggestions.append(f"Quand atteindrai-je mon objectif \"{goals[0].name}\"?")
        if recurring > 0:
            suggestions.append("Combien je dépense en abonnements?")
        suggestions.append("Puis-je me permettre un achat de 500€?")
    else:
        suggestions.append("Como estou financeiramente este mês?")
        if tx_count > 5:
            suggestions.append("Onde posso cortar gastos?")
            suggestions.append("Compara este mês com o anterior")
        suggestions.append("Qual é a minha taxa de poupança?")
        if goals:
            suggestions.append(f"Quando vou atingir a meta \"{goals[0].name}\"?")
        if recurring > 0:
            suggestions.append("Quanto gasto em subscrições?")
        suggestions.append("Posso comprar algo de 500€?")

    return {"suggestions": suggestions[:6]}


# ── Copilot message persistence ──

@router.get('/messages')
async def get_copilot_messages(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail='Pro subscription required')

    convo = (
        db.query(models.CopilotConversation)
        .filter(models.CopilotConversation.user_id == current_user.id)
        .order_by(models.CopilotConversation.updated_at.desc())
        .first()
    )
    if not convo:
        return {'messages': []}

    msgs = (
        db.query(models.CopilotMessage)
        .filter(models.CopilotMessage.conversation_id == convo.id)
        .order_by(models.CopilotMessage.created_at.asc())
        .all()
    )
    return {
        'conversation_id': str(convo.id),
        'messages': [
            {'role': m.role, 'content': m.content}
            for m in msgs
        ],
    }


class SaveMessagesRequest(BaseModel):
    messages: List[ChatMessage] = Field(default_factory=list, max_length=200)


@router.post('/messages')
async def save_copilot_messages(
    body: SaveMessagesRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail='Pro subscription required')

    convo = (
        db.query(models.CopilotConversation)
        .filter(models.CopilotConversation.user_id == current_user.id)
        .order_by(models.CopilotConversation.updated_at.desc())
        .first()
    )
    if not convo:
        convo = models.CopilotConversation(user_id=current_user.id)
        db.add(convo)
        db.flush()

    db.query(models.CopilotMessage).filter(
        models.CopilotMessage.conversation_id == convo.id
    ).delete()

    for msg in body.messages[-100:]:
        db.add(models.CopilotMessage(
            conversation_id=convo.id,
            role=msg.role,
            content=msg.content,
        ))

    convo.updated_at = func.now()
    db.commit()
    return {'ok': True, 'conversation_id': str(convo.id)}


@router.delete('/messages')
async def clear_copilot_messages(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail='Pro subscription required')

    convos = (
        db.query(models.CopilotConversation)
        .filter(models.CopilotConversation.user_id == current_user.id)
        .all()
    )
    for c in convos:
        db.delete(c)
    db.commit()
    return {'ok': True}
