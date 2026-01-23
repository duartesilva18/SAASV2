from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from ..core.dependencies import get_db
from ..core.audit import log_action
from ..models import database as models
from .. import schemas
from .auth import get_current_user
from uuid import UUID
from datetime import date

router = APIRouter(prefix='/categories', tags=['categories'])

@router.get('/', response_model=List[schemas.CategoryResponse])
async def get_categories(request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Usar workspace cacheado se disponível
    workspace = getattr(request.state, 'workspace', None)
    if not workspace:
        workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
        if not workspace:
            raise HTTPException(status_code=404, detail='Workspace not found')
        request.state.workspace = workspace
    
    return db.query(models.Category).filter(models.Category.workspace_id == workspace.id).all()

@router.get('/stats', response_model=List[schemas.CategoryStats])
async def get_category_stats(request: Request, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    # Usar workspace cacheado se disponível
    workspace = getattr(request.state, 'workspace', None)
    if not workspace:
        workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
        if not workspace:
            raise HTTPException(status_code=404, detail='Workspace not found')
        request.state.workspace = workspace
    
    today = date.today()
    start_of_month = date(today.year, today.month, 1)
    
    transactions = db.query(models.Transaction).join(models.Category).filter(
        models.Transaction.workspace_id == workspace.id,
        models.Transaction.transaction_date >= start_of_month,
        models.Category.type == 'expense',
        func.abs(models.Transaction.amount_cents) != 1  # Filtrar transações de seed (1 cêntimo)
    ).all()
    
    total_monthly_cents = sum(t.amount_cents for t in transactions)
    
    stats = {}
    for t in transactions:
        cat_id = str(t.category_id)
        if cat_id not in stats:
            stats[cat_id] = {
                'category_id': t.category_id,
                'name': t.category.name,
                'total_spent_cents': 0,
                'count': 0,
                'color': t.category.color_hex,
                'icon': t.category.icon
            }
        stats[cat_id]['total_spent_cents'] += t.amount_cents
        stats[cat_id]['count'] += 1
    
    result = []
    for cat_id, data in stats.items():
        percentage = (data['total_spent_cents'] / total_monthly_cents * 100) if total_monthly_cents > 0 else 0
        result.append(schemas.CategoryStats(
            **data,
            percentage=round(percentage, 1)
        ))
    
    result.sort(key=lambda x: x.total_spent_cents, reverse=True)
    return result

@router.post('/', response_model=schemas.CategoryResponse)
async def create_category(request: Request, category_in: schemas.CategoryBase, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    
    # Bloquear criação de novas categorias de Investimento ou Fundo de Emergência
    if category_in.vault_type in ['investment', 'emergency']:
        existing_special = db.query(models.Category).filter(
            models.Category.workspace_id == workspace.id,
            models.Category.vault_type == category_in.vault_type
        ).first()
        if existing_special:
            raise HTTPException(
                status_code=400, 
                detail=f'Já tens uma categoria de {"Investimento" if category_in.vault_type == "investment" else "Fundo de Emergência"}. Não podes criar múltiplas.'
            )
    
    new_category = models.Category(
        **category_in.dict(),
        workspace_id=workspace.id
    )
    db.add(new_category)
    try:
        db.commit()
        db.refresh(new_category)
        
        await log_action(db, action='create_category', user_id=current_user.id, details=f'name: {new_category.name}', request=request)
        return new_category
    except Exception as e:
        db.rollback()
        error_msg = str(e)
        if "unique_name" in error_msg or "already exists" in error_msg:
            raise HTTPException(status_code=400, detail='Já existe uma categoria com este nome neste workspace.')
        raise HTTPException(status_code=400, detail=f'Erro ao criar categoria: {error_msg}')

@router.patch('/{category_id}', response_model=schemas.CategoryResponse)
async def update_category(request: Request, category_id: UUID, category_in: schemas.CategoryUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    db_category = db.query(models.Category).filter(
        models.Category.id == category_id,
        models.Category.workspace_id == workspace.id
    ).first()
    
    if not db_category:
        raise HTTPException(status_code=404, detail='Categoria não encontrada')
    
    update_data = category_in.dict(exclude_unset=True)
    
    # Bloquear alteração de vault_type para investment/emergency se já existir
    if 'vault_type' in update_data and update_data['vault_type'] != db_category.vault_type:
        if update_data['vault_type'] in ['investment', 'emergency']:
            existing_special = db.query(models.Category).filter(
                models.Category.workspace_id == workspace.id,
                models.Category.vault_type == update_data['vault_type'],
                models.Category.id != category_id
            ).first()
            if existing_special:
                raise HTTPException(
                    status_code=400, 
                    detail=f'Já tens uma categoria de {"Investimento" if update_data["vault_type"] == "investment" else "Fundo de Emergência"}.'
                )
        
        # Bloquear alteração de uma categoria especial para 'none' se quisermos manter a regra rígida
        if db_category.vault_type in ['investment', 'emergency'] and update_data['vault_type'] == 'none':
             raise HTTPException(
                status_code=400, 
                detail='Não podes transformar uma categoria de Cofre numa categoria normal.'
            )

    for field, value in update_data.items():
        setattr(db_category, field, value)
    
    db.commit()
    db.refresh(db_category)
    
    await log_action(db, action='update_category', user_id=current_user.id, details=f'id: {category_id}', request=request)
    return db_category

@router.delete('/{category_id}')
async def delete_category(request: Request, category_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    db_category = db.query(models.Category).filter(
        models.Category.id == category_id,
        models.Category.workspace_id == workspace.id
    ).first()
    
    if not db_category:
        raise HTTPException(status_code=404, detail='Categoria não encontrada')
    
    # Proteção especial: Só bloqueia se for categoria padrão OU se for uma das categorias de cofre principais
    is_protected_name = (
        (db_category.vault_type == 'investment' and db_category.name.upper() in ['INVESTIMENTO', 'INVESTIMENTOS']) or
        (db_category.vault_type == 'emergency' and db_category.name.upper() in ['FUNDO DE EMERGÊNCIA', 'FUNDO DE EMERGENCIA'])
    )
    
    if db_category.is_default or is_protected_name:
        raise HTTPException(status_code=400, detail='Não é possível eliminar as categorias de Cofre principais ou categorias padrão')
    
    has_transactions = db.query(models.Transaction).filter(models.Transaction.category_id == category_id).first()
    if has_transactions:
        raise HTTPException(status_code=400, detail='Esta categoria tem transações associadas. Mude as transações de categoria antes de a eliminar.')
    
    name = db_category.name
    db.delete(db_category)
    db.commit()
    
    await log_action(db, action='delete_category', user_id=current_user.id, details=f'name: {name}', request=request)
    return {'message': 'Categoria eliminada com sucesso'}

@router.post('/bulk-delete')
async def bulk_delete_categories(request: Request, category_ids: List[UUID], db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    
    categories = db.query(models.Category).filter(
        models.Category.id.in_(category_ids),
        models.Category.workspace_id == workspace.id
    ).all()
    
    if not categories:
        return {'message': 'Nenhuma categoria encontrada para eliminar'}
    
    deleted_count = 0
    errors = []
    
    for cat in categories:
        # Mesmas proteções do delete individual
        is_protected_name = (
            (cat.vault_type == 'investment' and cat.name.upper() in ['INVESTIMENTO', 'INVESTIMENTOS']) or
            (cat.vault_type == 'emergency' and cat.name.upper() in ['FUNDO DE EMERGÊNCIA', 'FUNDO DE EMERGENCIA'])
        )
        
        if cat.is_default or is_protected_name:
            errors.append(f"Não é possível eliminar '{cat.name}' (categoria protegida)")
            continue
            
        has_transactions = db.query(models.Transaction).filter(models.Transaction.category_id == cat.id).first()
        if has_transactions:
            errors.append(f"Não é possível eliminar '{cat.name}' (tem transações associadas)")
            continue
            
        db.delete(cat)
        deleted_count += 1
    
    db.commit()
    
    await log_action(db, action='bulk_delete_categories', user_id=current_user.id, details=f'deleted: {deleted_count}, errors: {len(errors)}', request=request)
    
    return {
        'message': f'{deleted_count} categorias eliminadas com sucesso.',
        'errors': errors
    }

