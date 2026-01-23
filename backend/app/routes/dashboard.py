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


@router.get('/snapshot', response_model=schemas.DashboardSnapshotResponse)
async def get_dashboard_snapshot(
    request: Request,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    include_collections: bool = True  # Parâmetro para controlar se retorna collections
):
    """
    Endpoint composto otimizado para o dashboard.
    
    Estrutura clara:
    - snapshot: Dados financeiros estáveis (fonte de verdade)
    - collections: Dados descartáveis para UI específica
    
    Parâmetros:
    - include_collections: Se False, retorna apenas snapshot (útil para mobile/analytics)
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
    
    # Buscar transações (últimas 100) com eager loading
    # IMPORTANTE: Buscar todas para cálculo correto do snapshot
    transactions = db.query(models.Transaction).options(
        joinedload(models.Transaction.category)
    ).filter(
        models.Transaction.workspace_id == workspace.id,
        func.abs(models.Transaction.amount_cents) != 1
    ).order_by(
        models.Transaction.transaction_date.desc()
    ).limit(100).all()
    
    # Buscar todas as categorias
    categories = db.query(models.Category).filter(
        models.Category.workspace_id == workspace.id
    ).all()
    
    # Calcular snapshot financeiro (fonte única de verdade)
    # O snapshot é calculado com TODAS as transações, não apenas as recentes
    snapshot = FinancialEngine.calculate_snapshot(
        transactions=transactions,
        categories=categories,
        workspace=workspace
    )
    
    # Calcular dias restantes no mês
    today = date.today()
    days_in_month = (date(today.year, today.month + 1, 1) - timedelta(days=1)).day
    days_passed = today.day
    days_left = max(1, days_in_month - days_passed)
    
    # Calcular daily allowance
    total_budget = snapshot.income if snapshot.income > 0 else sum(
        cat.monthly_limit_cents / 100 for cat in categories if cat.monthly_limit_cents
    )
    remaining_money = max(0, total_budget - snapshot.expenses)
    daily_allowance = remaining_money / days_left if days_left > 0 else 0
    
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

