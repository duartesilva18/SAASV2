from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from typing import List
from ..core.dependencies import get_db
from ..core.audit import log_action
from ..models import database as models
from .. import schemas
from .auth import get_current_user
from uuid import UUID
from datetime import date
from .transactions import _effective_day_for_month

router = APIRouter(prefix='/recurring', tags=['recurring'])

@router.get('/', response_model=List[schemas.RecurringTransactionResponse])
async def get_recurring_transactions(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    
    return db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.workspace_id == workspace.id
    ).all()

@router.post('/', response_model=schemas.RecurringTransactionResponse)
async def create_recurring_transaction(request: Request, recurring_in: schemas.RecurringTransactionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    
    db_recurring = models.RecurringTransaction(
        **recurring_in.dict(),
        workspace_id=workspace.id
    )
    db.add(db_recurring)
    db.commit()
    db.refresh(db_recurring)
    
    await log_action(db, action='create_recurring', user_id=current_user.id, details=f'desc: {db_recurring.description}', request=request)
    return db_recurring

@router.patch('/{recurring_id}', response_model=schemas.RecurringTransactionResponse)
async def update_recurring_transaction(request: Request, recurring_id: UUID, recurring_in: schemas.RecurringTransactionUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    db_recurring = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.id == recurring_id,
        models.RecurringTransaction.workspace_id == workspace.id
    ).first()
    
    if not db_recurring:
        raise HTTPException(status_code=404, detail='Recurring transaction not found')
    
    update_data = recurring_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(db_recurring, field, value)
    
    db.commit()
    db.refresh(db_recurring)
    
    await log_action(db, action='update_recurring', user_id=current_user.id, details=f'id: {recurring_id}', request=request)
    return db_recurring

@router.post('/{recurring_id}/confirm', response_model=schemas.TransactionResponse)
async def confirm_recurring_transaction(request: Request, recurring_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    db_recurring = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.id == recurring_id,
        models.RecurringTransaction.workspace_id == workspace.id
    ).first()
    
    if not db_recurring:
        raise HTTPException(status_code=404, detail='Recurring transaction not found')
    
    today = date.today()
    start_of_month = date(today.year, today.month, 1)
    from sqlalchemy import or_
    existing = db.query(models.Transaction).filter(
        models.Transaction.workspace_id == workspace.id,
        or_(
            models.Transaction.description == db_recurring.description,
            models.Transaction.description == f"(R) {db_recurring.description}"
        ),
        models.Transaction.amount_cents == db_recurring.amount_cents,
        models.Transaction.transaction_date >= start_of_month
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail='Este mês já foi registado um pagamento para esta recorrente.')
    
    effective_day = _effective_day_for_month(today.year, today.month, db_recurring.day_of_month)
    new_t = models.Transaction(
        workspace_id=workspace.id,
        category_id=db_recurring.category_id,
        amount_cents=db_recurring.amount_cents,
        description=f"(R) {db_recurring.description}",
        transaction_date=date(today.year, today.month, effective_day),
        is_installment=False
    )
    db.add(new_t)
    db.commit()
    db.refresh(new_t)
    
    await log_action(db, action='confirm_recurring', user_id=current_user.id, details=f'id: {recurring_id}', request=request)
    return new_t

@router.delete('/{recurring_id}')
async def delete_recurring_transaction(request: Request, recurring_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    db_recurring = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.id == recurring_id,
        models.RecurringTransaction.workspace_id == workspace.id
    ).first()
    
    if not db_recurring:
        raise HTTPException(status_code=404, detail='Recurring transaction not found')
    
    db.delete(db_recurring)
    db.commit()
    
    await log_action(db, action='delete_recurring', user_id=current_user.id, details=f'id: {recurring_id}', request=request)
    return {'message': 'Recurring transaction deleted successfully'}

