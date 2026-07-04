from fastapi import APIRouter, Depends, HTTPException, Body, Request
from sqlalchemy.orm import Session
from typing import List
from datetime import date
from ..core.dependencies import get_db
from ..core.limiter import limiter
from ..models import database as models
from .. import schemas
from .auth import get_current_user
from uuid import UUID
from ..core.workspace import resolve_user_workspace

router = APIRouter(prefix='/goals', tags=['goals'])

@router.get('/', response_model=List[schemas.SavingsGoalResponse])
async def get_goals(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = resolve_user_workspace(db, current_user.id)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    
    return db.query(models.SavingsGoal).filter(models.SavingsGoal.workspace_id == workspace.id).all()

@router.post('/', response_model=schemas.SavingsGoalResponse)
@limiter.limit('60/minute')
async def create_goal(request: Request, goal: schemas.SavingsGoalCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    workspace = resolve_user_workspace(db, current_user.id)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    
    db_goal = models.SavingsGoal(**goal.model_dump(), workspace_id=workspace.id)
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.patch('/{goal_id}', response_model=schemas.SavingsGoalResponse)
@limiter.limit('60/minute')
async def update_goal(request: Request, goal_id: UUID, goal_update: schemas.SavingsGoalUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    workspace = resolve_user_workspace(db, current_user.id)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    db_goal = db.query(models.SavingsGoal).filter(models.SavingsGoal.id == goal_id, models.SavingsGoal.workspace_id == workspace.id).first()
    
    if not db_goal:
        raise HTTPException(status_code=404, detail='Goal not found')
    
    update_data = goal_update.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(db_goal, key, value)
    
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.delete('/{goal_id}')
async def delete_goal(goal_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    workspace = resolve_user_workspace(db, current_user.id)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    db_goal = db.query(models.SavingsGoal).filter(models.SavingsGoal.id == goal_id, models.SavingsGoal.workspace_id == workspace.id).first()
    
    if not db_goal:
        raise HTTPException(status_code=404, detail='Goal not found')
    
    db.delete(db_goal)
    db.commit()
    return {'status': 'success'}


@router.post('/{goal_id}/deposit', response_model=schemas.SavingsGoalResponse)
@limiter.limit('60/minute')
async def deposit_into_goal(
    request: Request,
    goal_id: UUID,
    body: schemas.SavingsGoalDeposit,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    ):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    """Adicionar dinheiro à meta. Apenas atualiza o valor acumulado, sem criar transação."""
    workspace = resolve_user_workspace(db, current_user.id)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    db_goal = db.query(models.SavingsGoal).filter(
        models.SavingsGoal.id == goal_id,
        models.SavingsGoal.workspace_id == workspace.id,
    ).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail='Goal not found')
    amount_cents = body.amount_cents
    db_goal.current_amount_cents = (db_goal.current_amount_cents or 0) + amount_cents
    db.commit()
    db.refresh(db_goal)
    return db_goal


@router.post('/{goal_id}/close')
async def close_goal(
    goal_id: UUID,
    body: schemas.SavingsGoalClose = Body(default=None),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    ):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    """Terminar a meta. Opcionalmente cria uma transação (receita ou despesa) com o valor acumulado."""
    body = body or schemas.SavingsGoalClose()
    create_transaction = body.create_transaction
    transaction_type = (body.transaction_type or 'income').lower()
    if transaction_type not in ('income', 'expense'):
        transaction_type = 'income'
    workspace = resolve_user_workspace(db, current_user.id)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    db_goal = db.query(models.SavingsGoal).filter(
        models.SavingsGoal.id == goal_id,
        models.SavingsGoal.workspace_id == workspace.id,
    ).first()
    if not db_goal:
        raise HTTPException(status_code=404, detail='Goal not found')
    current = db_goal.current_amount_cents or 0
    if create_transaction and current > 0:
        amount_cents = current if transaction_type == 'income' else -current
        tx = models.Transaction(
            workspace_id=workspace.id,
            category_id=None,
            amount_cents=amount_cents,
            description=f'Meta concluída: {db_goal.name}',
            transaction_date=date.today(),
        )
        db.add(tx)
    db.delete(db_goal)
    db.commit()
    return {'status': 'success', 'message': 'Meta terminada.'}

