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
from .auth import get_current_user
from .transactions import process_automatic_recurring

router = APIRouter(prefix='/dashboard', tags=['dashboard'])


def _first_day_of_month(y: int, m: int) -> date:
    """m 1-12"""
    return date(y, m, 1)


def _last_day_of_month(y: int, m: int) -> date:
    """m 1-12"""
    if m == 12:
        return date(y, 12, 31)
    return date(y, m + 1, 1) - timedelta(days=1)


@router.get('/snapshot', response_model=schemas.DashboardSnapshotResponse)
async def get_dashboard_snapshot(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
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
    # Buscar workspace (com cache se disponível)
    workspace = getattr(request.state, 'workspace', None)
    if not workspace:
        workspace = db.query(models.Workspace).filter(
            models.Workspace.owner_id == current_user.id
        ).first()
        if not workspace:
            raise HTTPException(status_code=404, detail='Workspace not found')
        request.state.workspace = workspace  # Cache no request
    
    # Processar recurring automático
    process_automatic_recurring(db, workspace.id)
    
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
    
    # Calcular snapshot financeiro (fonte única de verdade)
    snapshot = FinancialEngine.calculate_snapshot(
        transactions=transactions,
        categories=categories,
        workspace=workspace,
        period_start=period_start_arg,
        period_end=period_end_arg
    )
    
    # Dias restantes e daily allowance (só faz sentido para o mês atual)
    today = date.today()
    if period_start_arg is not None and period_end_arg is not None:
        if period_start_arg <= today <= period_end_arg:
            days_in_month = (date(period_start_arg.year, period_start_arg.month + 1, 1) - timedelta(days=1)).day if period_start_arg.month < 12 else 31
            days_passed = today.day
            days_left = max(1, days_in_month - days_passed)
        else:
            days_left = 0
    else:
        days_in_month = (date(today.year, today.month + 1, 1) - timedelta(days=1)).day
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

