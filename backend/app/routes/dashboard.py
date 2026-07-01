"""
Dashboard endpoints - Endpoints otimizados para o dashboard
"""
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from typing import List
from datetime import datetime, timedelta, date
from ..core.dependencies import get_db
from ..models import database as models
from .. import schemas
from ..core.financial_engine import FinancialEngine, FinancialSnapshot
from .auth import get_current_user, get_current_workspace

router = APIRouter(prefix='/dashboard', tags=['dashboard'])


def _first_day_of_month(y: int, m: int) -> date:
    """m 1-12"""
    return date(y, m, 1)


def _last_day_of_month(y: int, m: int) -> date:
    """m 1-12"""
    if m == 12:
        return date(y, 12, 31)
    return date(y, m + 1, 1) - timedelta(days=1)


@router.get('/totals', response_model=schemas.LifetimeTotalsResponse)
async def get_lifetime_totals(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    workspace: models.Workspace = Depends(get_current_workspace),
):
    """
    Totais acumulados (toda a história) somados em SQL — fonte de verdade para saldos
    de cofre e resumos de receitas/despesas, para o frontend não depender de listas paginadas.
    """
    lt = FinancialEngine.calculate_lifetime_totals(db, workspace.id)
    opening = (workspace.opening_balance_cents / 100) if workspace.opening_balance_cents else 0.0
    vault_total = lt.vault_emergency + lt.vault_investment
    available_cash = max(0.0, opening + lt.income - lt.expenses)
    net_worth = vault_total + available_cash
    return schemas.LifetimeTotalsResponse(
        income=lt.income,
        expenses=lt.expenses,
        balance=lt.income - lt.expenses,
        vault_emergency=lt.vault_emergency,
        vault_investment=lt.vault_investment,
        vault_total=vault_total,
        available_cash=available_cash,
        net_worth=net_worth,
        currency=current_user.currency,
    )


@router.get('/snapshot', response_model=schemas.DashboardSnapshotResponse)
async def get_dashboard_snapshot(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    workspace: models.Workspace = Depends(get_current_workspace),
    include_collections: bool = True,  # Parâmetro para controlar se retorna collections
    year: int | None = None,   # Ano do mês a filtrar (ex: 2025)
    month: int | None = None   # Mês 1-12
):
    """
    Endpoint composto otimizado para o dashboard.
    
    Estrutura clara:
    - snapshot: Dados financeiros estáveis (fonte de verdade)
    - collections: Dados descartáveis para UI específica
    
    Parâmetros:
    - include_collections: Se False, retorna apenas snapshot (útil para mobile/analytics)
    - year, month: Se ambos presentes, snapshot e collections limitam-se a esse mês (1-12).
    """
    # workspace obtido via dependency get_current_workspace (cacheado no request.state).
    # NOTA: a criação de transações recorrentes deixou de correr no caminho de leitura
    # (era N+1 + race condition); é feita apenas pelo job diário em main.py.

    # Período opcional (mês selecionado)
    period_start_arg: date | None = None
    period_end_arg: date | None = None
    if year is not None and month is not None and 1 <= month <= 12:
        period_start_arg = _first_day_of_month(year, month)
        period_end_arg = _last_day_of_month(year, month)
    
    base_q = (
        db.query(models.Transaction)
        .options(joinedload(models.Transaction.category))
        .filter(
            models.Transaction.workspace_id == workspace.id,
            func.abs(models.Transaction.amount_cents) != 1
        )
    )
    if period_start_arg is not None and period_end_arg is not None:
        base_q = base_q.filter(
            models.Transaction.transaction_date >= period_start_arg,
            models.Transaction.transaction_date <= period_end_arg
        )
    
    transactions = base_q.order_by(models.Transaction.transaction_date.desc()).limit(500).all()
    
    # Buscar todas as categorias
    categories = db.query(models.Category).filter(
        models.Category.workspace_id == workspace.id
    ).all()
    
    # Totais acumulados (toda a história) via SQL SUM — para available_cash/net_worth/
    # cofres/saldo acumulado serem corretos mesmo com >500 transações ou filtro de mês.
    lifetime = FinancialEngine.calculate_lifetime_totals(db, workspace.id)

    # Calcular snapshot financeiro (fonte única de verdade)
    snapshot = FinancialEngine.calculate_snapshot(
        transactions=transactions,
        categories=categories,
        workspace=workspace,
        period_start=period_start_arg,
        period_end=period_end_arg,
        lifetime=lifetime,
    )
    
    # Dias restantes e daily allowance (só faz sentido para o mês atual)
    today = date.today()
    if period_start_arg is not None and period_end_arg is not None:
        if period_start_arg <= today <= period_end_arg:
            # _last_day_of_month trata Dezembro corretamente (sem month+1 == 13)
            days_in_month = _last_day_of_month(period_start_arg.year, period_start_arg.month).day
            days_passed = today.day
            days_left = max(1, days_in_month - days_passed)
        else:
            days_left = 0
    else:
        # BUGFIX: em Dezembro today.month + 1 == 13 rebentava com ValueError.
        days_in_month = _last_day_of_month(today.year, today.month).day
        days_passed = today.day
        days_left = max(1, days_in_month - days_passed)
    
    total_budget = snapshot.income if snapshot.income > 0 else sum(
        (cat.monthly_limit_cents or 0) / 100 for cat in categories if cat.monthly_limit_cents
    )
    remaining_money = max(0, total_budget - snapshot.expenses)
    daily_allowance = remaining_money / days_left if days_left > 0 else 0.0
    
    # Construir resposta do snapshot (sempre presente)
    snapshot_response = schemas.FinancialSnapshotResponse(
        income=snapshot.income,
        expenses=snapshot.expenses,
        vault_total=snapshot.vault_total,
        vault_emergency=snapshot.vault_emergency,
        vault_investment=snapshot.vault_investment,
        available_cash=snapshot.available_cash,
        net_worth=snapshot.net_worth,
        saving_rate=snapshot.saving_rate,
        cumulative_balance=snapshot.cumulative_balance,
        daily_allowance=daily_allowance,
        remaining_money=remaining_money,
        days_left=days_left,
        period_start=snapshot.period_start,
        period_end=snapshot.period_end,
        transaction_count=snapshot.transaction_count
    )
    
    # Collections (apenas se solicitado)
    collections = None
    if include_collections:
        # Buscar recurring transactions (apenas se necessário)
        recurring = db.query(models.RecurringTransaction).filter(
            models.RecurringTransaction.workspace_id == workspace.id
        ).all()
        
        # Retornar apenas últimas 10 transações para o dashboard (UI específica)
        recent_transactions = transactions[:10]
        
        collections = schemas.DashboardCollectionsResponse(
            recent_transactions=recent_transactions,
            categories=categories,
            recurring=recurring
        )
    else:
        # Retornar collections vazias se não solicitado
        collections = schemas.DashboardCollectionsResponse(
            recent_transactions=[],
            categories=[],
            recurring=[]
        )
    
    return schemas.DashboardSnapshotResponse(
        version="1.0",
        snapshot=snapshot_response,
        collections=collections,
        currency=current_user.currency
    )

