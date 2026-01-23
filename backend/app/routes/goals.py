from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from ..core.dependencies import get_db
from ..models import database as models
from .. import schemas
from .auth import get_current_user
from uuid import UUID

router = APIRouter(prefix='/goals', tags=['goals'])

@router.get('/', response_model=List[schemas.SavingsGoalResponse])
async def get_goals(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    
    return db.query(models.SavingsGoal).filter(models.SavingsGoal.workspace_id == workspace.id).all()

@router.post('/', response_model=schemas.SavingsGoalResponse)
async def create_goal(goal: schemas.SavingsGoalCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    
    db_goal = models.SavingsGoal(**goal.model_dump(), workspace_id=workspace.id)
    db.add(db_goal)
    db.commit()
    db.refresh(db_goal)
    return db_goal

@router.patch('/{goal_id}', response_model=schemas.SavingsGoalResponse)
async def update_goal(goal_id: UUID, goal_update: schemas.SavingsGoalUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
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
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    db_goal = db.query(models.SavingsGoal).filter(models.SavingsGoal.id == goal_id, models.SavingsGoal.workspace_id == workspace.id).first()
    
    if not db_goal:
        raise HTTPException(status_code=404, detail='Goal not found')
    
    db.delete(db_goal)
    db.commit()
    return {'status': 'success'}

