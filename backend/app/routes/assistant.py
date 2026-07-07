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

from ..core.dependencies import get_db, SessionLocal
from ..core.config import settings
from ..core.financial_engine import FinancialEngine
from ..core.limiter import limiter
from ..models import database as models
from .auth import get_current_user
from ..core.workspace import resolve_user_workspace

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

    from sqlalchemy.orm import load_only
    all_txs = db.query(models.Transaction).options(
        load_only(
            models.Transaction.amount_cents,
            models.Transaction.transaction_date,
            models.Transaction.category_id,
            models.Transaction.description,
        )
    ).filter(
        models.Transaction.workspace_id == workspace.id,
        models.Transaction.transaction_date >= six_months_ago.date(),
        func.abs(models.Transaction.amount_cents) != 1,
    ).order_by(models.Transaction.transaction_date.desc()).limit(3000).all()

    this_month_txs = [t for t in all_txs if t.transaction_date >= this_month_start.date()]
    last_month_txs = [t for t in all_txs if last_month_start.date() <= t.transaction_date < this_month_start.date()]

    # Cash/cofres/net worth devem refletir toda a história (agregação SQL), não só o mês.
    lifetime = FinancialEngine.calculate_lifetime_totals(db, workspace.id)
    snapshot_this = FinancialEngine.calculate_snapshot(this_month_txs, categories, workspace,
                                                       period_start=this_month_start.date(),
                                                       period_end=now.date(),
                                                       lifetime=lifetime)
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


# Cache em memória do contexto financeiro por workspace (evita reconstruir ~3000 transações
# a cada mensagem da mesma conversa). TTL curto -> staleness máximo de ~90s.
import time as _time
_context_cache: dict = {}
_CONTEXT_TTL_SECONDS = 90

# Cliente OpenAI partilhado: criar um por request perdia o pool de ligações do httpx
# (um handshake TLS novo por chamada — e as ações com ferramentas fazem 2 chamadas).
_openai_client = None


def _get_openai_client():
    global _openai_client
    if _openai_client is None:
        from openai import OpenAI
        _openai_client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


def _build_financial_context_cached(db: Session, user: models.User, workspace: models.Workspace) -> str:
    key = str(workspace.id)
    now = _time.time()
    hit = _context_cache.get(key)
    if hit and (now - hit[0]) < _CONTEXT_TTL_SECONDS:
        return hit[1]
    ctx = _build_financial_context(db, user, workspace)
    _context_cache[key] = (now, ctx)
    return ctx


def _append_copilot_message(db: Session, user_id, role: str, content: str):
    """Acrescenta UMA mensagem à conversa mais recente do utilizador (cria se não existir).
    Append-only — fonte de verdade do histórico, sem o padrão destrutivo de delete+reinsert."""
    if not content:
        return
    convo = (
        db.query(models.CopilotConversation)
        .filter(models.CopilotConversation.user_id == user_id)
        .order_by(models.CopilotConversation.updated_at.desc())
        .first()
    )
    if not convo:
        convo = models.CopilotConversation(user_id=user_id)
        db.add(convo)
        db.flush()
    db.add(models.CopilotMessage(conversation_id=convo.id, role=role, content=content))
    convo.updated_at = func.now()
    db.commit()


# ── Ferramentas do Copilot: o assistente pode AGIR, não só responder ──────────
COPILOT_TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "create_savings_goal",
            "description": "Cria uma meta de poupança para o utilizador. Usa quando ele pedir explicitamente para criar uma meta/objetivo de poupança.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Nome da meta, ex.: 'Férias'"},
                    "target_amount_eur": {"type": "number", "description": "Valor objetivo em euros"},
                    "target_date": {"type": "string", "description": "Data limite YYYY-MM-DD (opcional; por omissão daqui a 1 ano)"},
                },
                "required": ["name", "target_amount_eur"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "set_category_limit",
            "description": "Define (ou remove, com 0) o limite mensal de orçamento de uma categoria de despesa existente.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category_name": {"type": "string", "description": "Nome da categoria, ex.: 'Alimentação'"},
                    "monthly_limit_eur": {"type": "number", "description": "Limite mensal em euros (0 remove o limite)"},
                },
                "required": ["category_name", "monthly_limit_eur"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "query_spending",
            "description": "Consulta quanto o utilizador gastou, no total ou numa categoria, num período. Usa para perguntas tipo 'quanto gastei em farmácia este ano?'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "category_name": {"type": "string", "description": "Categoria (opcional; omitir = todas)"},
                    "period": {"type": "string", "enum": ["this_month", "last_month", "last_3_months", "this_year"], "description": "Período da consulta"},
                },
                "required": ["period"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_transaction",
            "description": "Cria uma transação de despesa/receita. Usa quando o utilizador quer registar um gasto ou receita, ex.: 'adiciona 15€ café'.",
            "parameters": {
                "type": "object",
                "properties": {
                    "amount_eur": {"type": "number", "description": "Valor em euros, SEMPRE positivo (ex.: 220.00). O sinal é determinado por is_expense."},
                    "category_name": {"type": "string", "description": "Nome da categoria, ex.: 'Alimentação', 'Transporte'"},
                    "description": {"type": "string", "description": "Descrição breve, ex.: 'Café', 'Continente'"},
                    "is_expense": {"type": "boolean", "description": "true=despesa, false=receita"},
                    "transaction_date": {"type": "string", "description": "Data YYYY-MM-DD (opcional; por omissão hoje)"},
                },
                "required": ["amount_eur", "category_name", "description", "is_expense"],
            },
        },
    },
]

COPILOT_ACTIONS_PROMPT = (
    "\n\nAÇÕES DISPONÍVEIS: além de responder, podes EXECUTAR ações com as ferramentas fornecidas "
    "(registar transações, criar metas de poupança, definir limites de orçamento, consultar gastos). "
    "Usa-as quando o pedido for claro. Depois de executares, confirma ao utilizador em 1-2 frases o que foi feito, "
    "com os valores exatos. Nunca inventes resultados: usa apenas o que a ferramenta devolver."
)


def _match_category(db, workspace_id, name: str, cat_type: str = 'expense'):
    """Match tolerante de categoria por nome (exato → substring)."""
    if not name:
        return None
    cats = db.query(models.Category).filter(
        models.Category.workspace_id == workspace_id,
        models.Category.type == cat_type,
    ).all()
    low = name.strip().lower()
    for c in cats:
        if c.name.lower() == low:
            return c
    for c in cats:
        if low in c.name.lower() or c.name.lower() in low:
            return c
    return None


def _execute_copilot_tool(name: str, args: dict, user_id, workspace_id) -> dict:
    """Executa uma ferramenta do copilot numa sessão própria. Devolve dict serializável
    (o modelo usa-o para redigir a confirmação — nunca texto inventado)."""
    from datetime import date as _date, timedelta as _td
    _db = SessionLocal()
    try:
        if name == 'create_savings_goal':
            goal_name = (args.get('name') or '').strip()[:100]
            amount = float(args.get('target_amount_eur') or 0)
            if not goal_name or amount <= 0 or amount > 100_000_000:
                return {"ok": False, "error": "nome ou valor inválido"}
            try:
                target = _date.fromisoformat(str(args.get('target_date'))) if args.get('target_date') else None
            except ValueError:
                target = None
            if not target or target <= _date.today():
                target = _date.today() + _td(days=365)
            goal = models.SavingsGoal(
                workspace_id=workspace_id, name=goal_name, goal_type='expense',
                target_amount_cents=int(round(amount * 100)), target_date=target,
            )
            _db.add(goal)
            _db.commit()
            logger.info("Copilot criou meta '%s' (%.2f€) para user %s", goal_name, amount, user_id)
            return {"ok": True, "goal": goal_name, "target_amount_eur": amount, "target_date": target.isoformat()}

        if name == 'set_category_limit':
            cat = _match_category(_db, workspace_id, args.get('category_name') or '')
            if not cat:
                available = [c.name for c in _db.query(models.Category).filter(
                    models.Category.workspace_id == workspace_id, models.Category.type == 'expense').all()]
                return {"ok": False, "error": "categoria não encontrada", "categorias_existentes": available[:15]}
            limit = float(args.get('monthly_limit_eur') or 0)
            if limit < 0 or limit > 100_000_000:
                return {"ok": False, "error": "limite inválido"}
            cat.monthly_limit_cents = int(round(limit * 100))
            _db.commit()
            logger.info("Copilot definiu limite %.2f€ em '%s' para user %s", limit, cat.name, user_id)
            return {"ok": True, "category": cat.name, "monthly_limit_eur": limit, "removed": limit == 0}

        if name == 'query_spending':
            from datetime import date as d
            today = d.today()
            period = args.get('period') or 'this_month'
            if period == 'this_month':
                start, end = today.replace(day=1), today
            elif period == 'last_month':
                first_this = today.replace(day=1)
                end = first_this - _td(days=1)
                start = end.replace(day=1)
            elif period == 'last_3_months':
                start, end = today - _td(days=90), today
            else:  # this_year
                start, end = today.replace(month=1, day=1), today
            q = _db.query(
                func.coalesce(func.sum(func.abs(models.Transaction.amount_cents)), 0),
                func.count(models.Transaction.id),
            ).filter(
                models.Transaction.workspace_id == workspace_id,
                models.Transaction.amount_cents < 0,
                models.Transaction.transaction_date >= start,
                models.Transaction.transaction_date <= end,
                func.abs(models.Transaction.amount_cents) != 1,
            )
            cat = None
            if args.get('category_name'):
                cat = _match_category(_db, workspace_id, args['category_name'])
                if not cat:
                    return {"ok": False, "error": "categoria não encontrada"}
                q = q.filter(models.Transaction.category_id == cat.id)
            total_cents, count = q.first()
            return {
                "ok": True, "period": period, "from": start.isoformat(), "to": end.isoformat(),
                "category": cat.name if cat else "todas",
                "total_eur": round(int(total_cents or 0) / 100, 2), "transactions": int(count or 0),
            }

        if name == 'create_transaction':
            # Modelos mais pequenos enviam args imperfeitos ("220,00 €" como string,
            # is_expense como "true", descrição omitida) — normalizar em vez de rejeitar,
            # e devolver erros ESPECÍFICOS para o modelo se autocorrigir na ronda seguinte.
            raw_amount = args.get('amount_eur')
            if isinstance(raw_amount, str):
                raw_amount = (raw_amount.replace('€', '').replace('EUR', '')
                              .replace(' ', '').replace(',', '.'))
            try:
                amount = float(raw_amount or 0)
            except (ValueError, TypeError):
                logger.warning("create_transaction: amount_eur não numérico: %r", args.get('amount_eur'))
                return {"ok": False, "error": "amount_eur inválido: envia um número, ex.: 220.00"}

            is_expense = args.get('is_expense', True)
            if isinstance(is_expense, str):
                is_expense = is_expense.strip().lower() not in ('false', '0', 'no', 'nao', 'não')

            cat_name = (args.get('category_name') or '').strip()
            # Sem descrição → usar o nome da categoria (melhor registar do que falhar)
            desc = (args.get('description') or '').strip()[:100] or cat_name

            # Se o modelo enviar negativo (intenção óbvia: despesa), aceitar — o sinal
            # final é sempre decidido por is_expense.
            amount = abs(amount)

            if not cat_name:
                return {"ok": False, "error": "falta category_name: indica a categoria da transação"}
            if amount == 0:
                return {"ok": False, "error": "amount_eur em falta ou zero: envia o valor em euros, ex.: 220.00"}
            if amount > 1_000_000:
                return {"ok": False, "error": "amount_eur demasiado alto: confirma o valor com o utilizador"}

            cat_type = 'expense' if is_expense else 'income'
            cat = _match_category(_db, workspace_id, cat_name, cat_type)
            if not cat:
                available = [c.name for c in _db.query(models.Category).filter(
                    models.Category.workspace_id == workspace_id,
                    models.Category.type == cat_type).all()]
                return {"ok": False, "error": "categoria não encontrada", "categorias": available[:15]}

            try:
                tx_date = _date.fromisoformat(str(args.get('transaction_date'))) if args.get('transaction_date') else _date.today()
            except ValueError:
                tx_date = _date.today()

            amount_cents = int(round(amount * 100))
            if is_expense:
                amount_cents = -amount_cents

            tx = models.Transaction(
                workspace_id=workspace_id, category_id=cat.id, amount_cents=amount_cents,
                description=desc, transaction_date=tx_date, created_by_user_id=user_id,
            )
            _db.add(tx)
            _db.commit()
            logger.info("Copilot criou transação %s%.2f€ em '%s' para user %s",
                       "-" if is_expense else "+", amount, cat.name, user_id)
            return {
                "ok": True, "type": "expense" if is_expense else "income",
                "amount_eur": amount, "category": cat.name, "description": desc,
                "transaction_date": tx_date.isoformat(),
            }

        return {"ok": False, "error": f"ferramenta desconhecida: {name}"}
    except Exception as e:
        _db.rollback()
        logger.exception("Copilot tool '%s' falhou: %s", name, e)
        return {"ok": False, "error": "erro interno ao executar a ação"}
    finally:
        _db.close()


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

    workspace = resolve_user_workspace(db, current_user.id)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')

    header_lang = (request.headers.get('accept-language') or '').lower()
    user_lang = (getattr(current_user, 'language', None) or 'pt').lower()
    lang = header_lang or user_lang

    financial_context = _build_financial_context_cached(db, current_user, workspace)
    system_prompt = _get_system_prompt(current_user, financial_context, lang) + COPILOT_ACTIONS_PROMPT

    # Histórico aparado: 8 mensagens, cada uma até 1500 chars (respostas antigas com
    # [CHART] gigantes inflavam o prompt → mais tokens de entrada → primeira palavra mais lenta).
    messages = [{"role": "system", "content": system_prompt}]
    for msg in body.history[-8:]:
        content = msg.content if len(msg.content) <= 1500 else msg.content[:1500] + ' […]'
        messages.append({"role": msg.role, "content": content})
    messages.append({"role": "user", "content": body.message})

    # Persistir a mensagem do utilizador imediatamente (fonte de verdade no servidor).
    user_id = current_user.id
    try:
        _append_copilot_message(db, user_id, 'user', body.message)
    except Exception as e:
        db.rollback()
        logger.warning(f"Falha ao persistir mensagem do utilizador: {e}")

    client = _get_openai_client()

    ws_id = workspace.id

    def generate():
        full_text = []
        try:
            # Até 3 rondas: o modelo pode pedir ferramentas (agir) antes da resposta final.
            convo = list(messages)
            for _round in range(3):
                stream = client.chat.completions.create(
                    model=settings.OPENAI_CHAT_MODEL,
                    messages=convo,
                    max_tokens=1200,
                    temperature=0.7,
                    stream=True,
                    tools=COPILOT_TOOLS,
                )
                tool_calls: dict = {}
                finish_reason = None
                for chunk in stream:
                    choice = chunk.choices[0] if chunk.choices else None
                    if not choice:
                        continue
                    if choice.finish_reason:
                        finish_reason = choice.finish_reason
                    delta = choice.delta
                    if delta and delta.content:
                        full_text.append(delta.content)
                        data = json.dumps({"type": "token", "content": delta.content}, ensure_ascii=False)
                        yield f"data: {data}\n\n"
                    if delta and delta.tool_calls:
                        for tc in delta.tool_calls:
                            entry = tool_calls.setdefault(tc.index, {"id": "", "name": "", "args": ""})
                            if tc.id:
                                entry["id"] = tc.id
                            if tc.function and tc.function.name:
                                entry["name"] = tc.function.name
                            if tc.function and tc.function.arguments:
                                entry["args"] += tc.function.arguments

                if finish_reason != 'tool_calls' or not tool_calls:
                    break  # resposta final já foi transmitida

                # Executar as ferramentas pedidas e voltar ao modelo com os resultados
                assistant_msg = {
                    "role": "assistant",
                    "content": None,
                    "tool_calls": [
                        {"id": e["id"], "type": "function",
                         "function": {"name": e["name"], "arguments": e["args"] or "{}"}}
                        for e in tool_calls.values()
                    ],
                }
                convo.append(assistant_msg)
                for e in tool_calls.values():
                    try:
                        parsed_args = json.loads(e["args"] or "{}")
                    except json.JSONDecodeError:
                        parsed_args = {}
                    result = _execute_copilot_tool(e["name"], parsed_args, user_id, ws_id)
                    convo.append({
                        "role": "tool",
                        "tool_call_id": e["id"],
                        "content": json.dumps(result, ensure_ascii=False),
                    })

            yield f"data: {json.dumps({'type': 'done'})}\n\n"
        except Exception as e:
            logger.error(f"OpenAI streaming error: {e}")
            error_data = json.dumps({"type": "error", "content": str(e)}, ensure_ascii=False)
            yield f"data: {error_data}\n\n"
        finally:
            # Gravar a resposta do assistente no fim do stream (sessão própria: a sessão do
            # request pode já estar a ser fechada quando o streaming termina).
            answer = ''.join(full_text).strip()
            if answer:
                _db = SessionLocal()
                try:
                    _append_copilot_message(_db, user_id, 'assistant', answer)
                except Exception as e:
                    _db.rollback()
                    logger.warning(f"Falha ao persistir resposta do assistente: {e}")
                finally:
                    _db.close()

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

    workspace = resolve_user_workspace(db, current_user.id)
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

    # NOTA: o /chat já persiste mensagens no servidor (fonte de verdade). Este endpoint
    # mantém-se por compatibilidade mas é AGORA NÃO-DESTRUTIVO: em vez de apagar e reinserir
    # (que causava race conditions e perda de mensagens), apenas acrescenta as mensagens do
    # cliente que ainda não estão guardadas (extensão por contagem).
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

    stored_count = (
        db.query(func.count(models.CopilotMessage.id))
        .filter(models.CopilotMessage.conversation_id == convo.id)
        .scalar()
    ) or 0

    incoming = body.messages[-100:]
    # Só acrescentar o que excede o que já está guardado (evita duplicar o que o /chat gravou).
    new_msgs = incoming[stored_count:] if len(incoming) > stored_count else []
    for msg in new_msgs:
        db.add(models.CopilotMessage(
            conversation_id=convo.id,
            role=msg.role,
            content=msg.content,
        ))

    if new_msgs:
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
