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
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
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
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    db_recurring = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.id == recurring_id,
        models.RecurringTransaction.workspace_id == workspace.id
    ).first()
    
    if not db_recurring:
        raise HTTPException(status_code=404, detail='Recurring transaction not found')
    
    today = date.today()
    new_t = models.Transaction(
        workspace_id=workspace.id,
        category_id=db_recurring.category_id,
        amount_cents=db_recurring.amount_cents,
        description=f"(R) {db_recurring.description}",
        transaction_date=date(today.year, today.month, db_recurring.day_of_month),
        is_installment=False
    )
    db.add(new_t)
    db.commit()
    db.refresh(new_t)
    
    await log_action(db, action='confirm_recurring', user_id=current_user.id, details=f'id: {recurring_id}', request=request)
    return new_t

@router.delete('/{recurring_id}')
async def delete_recurring_transaction(request: Request, recurring_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
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

