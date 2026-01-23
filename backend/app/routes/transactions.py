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

router = APIRouter(prefix='/transactions', tags=['transactions'])

def process_automatic_recurring(db: Session, workspace_id: UUID):
    today = date.today()
    
    rules = db.query(models.RecurringTransaction).filter(
        models.RecurringTransaction.workspace_id == workspace_id,
        models.RecurringTransaction.is_active == True,
        models.RecurringTransaction.process_automatically == True
    ).all()
    
    for rule in rules:
        if today.day >= rule.day_of_month:
            start_of_month = date(today.year, today.month, 1)
            
            existing = db.query(models.Transaction).filter(
                models.Transaction.workspace_id == workspace_id,
                models.Transaction.description == rule.description,
                models.Transaction.amount_cents == rule.amount_cents,
                models.Transaction.transaction_date >= start_of_month
            ).first()
            
            if existing:
                continue
            
            new_t = models.Transaction(
                workspace_id=workspace_id,
                category_id=rule.category_id,
                amount_cents=rule.amount_cents,
                description=rule.description,
                transaction_date=date(today.year, today.month, rule.day_of_month),
                is_installment=False
            )
            db.add(new_t)
    
    db.commit()

@router.get('/', response_model=List[schemas.TransactionResponse])
async def get_transactions(request: Request, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    import logging
    logger = logging.getLogger("transactions")
    
    # Usar workspace cacheado se disponível
    workspace = getattr(request.state, 'workspace', None)
    if not workspace:
        workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
        if not workspace:
            raise HTTPException(status_code=404, detail='Workspace not found')
        request.state.workspace = workspace
    
    process_automatic_recurring(db, workspace.id)
    
    # Filtrar transações de seed (1 cêntimo) diretamente na query SQL - muito mais rápido
    # Usar eager loading para evitar N+1 queries
    from sqlalchemy.orm import joinedload
    transactions = db.query(models.Transaction).options(
        joinedload(models.Transaction.category)
    ).filter(
        models.Transaction.workspace_id == workspace.id,
        func.abs(models.Transaction.amount_cents) != 1
    ).order_by(models.Transaction.created_at.desc()).offset(skip).limit(limit).all()
    
    # Contar total para logging (sem paginação)
    total_count = db.query(models.Transaction).filter(
        models.Transaction.workspace_id == workspace.id,
        func.abs(models.Transaction.amount_cents) != 1
    ).count()
    
    logger.info(f"GET /transactions/ - workspace_id: {workspace.id}, user_id: {current_user.id}, total: {total_count}, returned: {len(transactions)}")
    if transactions:
        logger.info(f"Primeira transacao: id={transactions[0].id}, description={transactions[0].description}, amount_cents={transactions[0].amount_cents}, created_at={transactions[0].created_at}")
    
    return transactions

@router.post('/', response_model=schemas.TransactionResponse)
async def create_transaction(request: Request, transaction_in: schemas.TransactionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace not found')
    
    # Validar que a data não é no futuro
    if transaction_in.transaction_date > date.today():
        raise HTTPException(status_code=400, detail='Não são permitidas transações com data no futuro.')
    
    # Validar que a categoria existe e pertence ao workspace
    category = None
    if transaction_in.category_id:
        category = db.query(models.Category).filter(
            models.Category.id == transaction_in.category_id,
            models.Category.workspace_id == workspace.id
        ).first()
        if not category:
            raise HTTPException(status_code=400, detail='Categoria não encontrada ou não pertence ao teu workspace.')
    
    # Validar que amount_cents não é zero
    if transaction_in.amount_cents == 0:
        raise HTTPException(status_code=400, detail='O valor da transação não pode ser zero.')
    
    # VALIDAÇÃO CRÍTICA: Regra única de sinais
    # income → amount_cents > 0
    # expense → amount_cents < 0
    # vault deposit → amount_cents > 0 (independente do type da categoria)
    # vault withdraw → amount_cents < 0 (independente do type da categoria)
    if category:
        if category.vault_type != 'none':
            # Vault: depósito > 0, resgate < 0
            # Para vault, o sinal determina depósito vs resgate, não o type da categoria
            if transaction_in.amount_cents > 0:
                # Depósito no vault (sempre positivo)
                pass  # Válido
            elif transaction_in.amount_cents < 0:
                # Resgate do vault (sempre negativo)
                pass  # Válido, será validado saldo abaixo
            else:
                raise HTTPException(
                    status_code=400,
                    detail=f'Transações de vault devem ter amount_cents diferente de zero. Recebido: {transaction_in.amount_cents}'
                )
        elif category.type == 'income' and category.vault_type == 'none':
            # Receita regular deve ser positiva
            if transaction_in.amount_cents < 0:
                raise HTTPException(
                    status_code=400, 
                    detail=f'Receitas devem ter amount_cents positivo. Recebido: {transaction_in.amount_cents}'
                )
        elif category.type == 'expense' and category.vault_type == 'none':
            # Despesa regular deve ser negativa
            if transaction_in.amount_cents > 0:
                raise HTTPException(
                    status_code=400, 
                    detail=f'Despesas devem ter amount_cents negativo. Recebido: {transaction_in.amount_cents}'
                )
    
    # Se é resgate de vault (amount negativo e categoria de vault), verificar saldo disponível
    if category and category.vault_type != 'none' and transaction_in.amount_cents < 0:
        # Calcular saldo atual do vault
        vault_transactions = db.query(models.Transaction).filter(
            models.Transaction.workspace_id == workspace.id,
            models.Transaction.category_id == category.id,
            func.abs(models.Transaction.amount_cents) != 1  # Excluir seed transactions
        ).all()
        
        # Calcular saldo: depósitos (positivos) aumentam, resgates (negativos) diminuem
        vault_balance = 0
        for t in vault_transactions:
            if t.amount_cents > 0:
                vault_balance += t.amount_cents  # Depósito
            else:
                vault_balance -= abs(t.amount_cents)  # Resgate
        
        # Verificar se há saldo suficiente E se não deixa negativo
        # Como transaction_in.amount_cents é negativo, subtraímos o valor absoluto
        withdrawal_amount = abs(transaction_in.amount_cents)
        balance_after_withdrawal = vault_balance - withdrawal_amount
        
        if withdrawal_amount > vault_balance:
            available_euros = vault_balance / 100
            raise HTTPException(
                status_code=400, 
                detail=f'Saldo insuficiente no {category.name}. Disponível: {available_euros:.2f}€'
            )
        
        # VALIDAÇÃO CRÍTICA: Não permitir que o saldo fique negativo
        if balance_after_withdrawal < 0:
            available_euros = vault_balance / 100
            raise HTTPException(
                status_code=400,
                detail=f'Não é possível retirar {withdrawal_amount / 100:.2f}€. O saldo ficaria negativo. Disponível: {available_euros:.2f}€'
            )
    
    new_transaction = models.Transaction(
        **transaction_in.dict(),
        workspace_id=workspace.id
    )
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    
    await log_action(db, action='create_transaction', user_id=current_user.id, details=f'amount: {new_transaction.amount_cents}, category_id: {new_transaction.category_id}', request=request)
    return new_transaction

@router.patch('/{transaction_id}', response_model=schemas.TransactionResponse)
async def update_transaction(request: Request, transaction_id: UUID, transaction_in: schemas.TransactionUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    db_transaction = db.query(models.Transaction).filter(
        models.Transaction.id == transaction_id,
        models.Transaction.workspace_id == workspace.id
    ).first()
    
    if not db_transaction:
        raise HTTPException(status_code=404, detail='Transação não encontrada')
    
    update_data = transaction_in.dict(exclude_unset=True)
    
    # Validar que a nova data não é no futuro
    if 'transaction_date' in update_data and update_data['transaction_date'] > date.today():
        raise HTTPException(status_code=400, detail='Não são permitidas transações com data no futuro.')

    for field, value in update_data.items():
        setattr(db_transaction, field, value)
    
    db.commit()
    db.refresh(db_transaction)
    
    await log_action(db, action='update_transaction', user_id=current_user.id, details=f'id: {transaction_id}', request=request)
    return db_transaction

@router.delete('/{transaction_id}')
async def delete_transaction(request: Request, transaction_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    workspace = db.query(models.Workspace).filter(models.Workspace.owner_id == current_user.id).first()
    db_transaction = db.query(models.Transaction).filter(
        models.Transaction.id == transaction_id,
        models.Transaction.workspace_id == workspace.id
    ).first()
    
    if not db_transaction:
        raise HTTPException(status_code=404, detail='Transação não encontrada')
    
    db.delete(db_transaction)
    db.commit()
    
    await log_action(db, action='delete_transaction', user_id=current_user.id, details=f'id: {transaction_id}', request=request)
    return {'message': 'Transação eliminada com sucesso'}

