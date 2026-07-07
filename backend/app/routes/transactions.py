from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import func, or_
from typing import List
from ..core.dependencies import get_db
from ..core.audit import log_action
from ..core.limiter import limiter
from ..models import database as models
from .. import schemas
from .auth import get_current_user, get_current_workspace
from uuid import UUID
from datetime import date
import calendar
import csv
import io
from ..core.workspace import resolve_user_workspace

router = APIRouter(prefix='/transactions', tags=['transactions'])


def _last_day_of_month(year: int, month: int) -> int:
    return calendar.monthrange(year, month)[1]


def _effective_day_for_month(year: int, month: int, day_of_month: int) -> int:
    """Dia a usar neste mês (ex.: 31 em fev -> 28 ou 29)."""
    return min(day_of_month, _last_day_of_month(year, month))


def process_automatic_recurring(db: Session, workspace_id: UUID):
    """
    Cria transações automáticas para regras recorrentes do mês atual (se já passou o dia).

    NOTA: deixou de ser chamada nos endpoints de leitura (era um N+1 — uma query de
    existência por regra — e tinha race condition em chamadas concorrentes). Agora corre
    apenas no job diário (_job_recurring_transactions em main.py), que é serializado.
    A verificação de existência é feita com UMA query por workspace, em memória.
    """
    try:
        today = date.today()
        start_of_month = date(today.year, today.month, 1)

        rules = db.query(models.RecurringTransaction).filter(
            models.RecurringTransaction.workspace_id == workspace_id,
            models.RecurringTransaction.is_active == True
        ).all()
        if not rules:
            return

        # Uma única query: transações já existentes este mês (evita N+1).
        existing_rows = db.query(
            models.Transaction.description,
            models.Transaction.amount_cents,
        ).filter(
            models.Transaction.workspace_id == workspace_id,
            models.Transaction.transaction_date >= start_of_month,
        ).all()
        # Chave de existência: (descrição sem prefixo "(R) ", amount_cents)
        existing_keys = set()
        for desc, amount in existing_rows:
            base = desc[4:] if desc and desc.startswith('(R) ') else desc
            existing_keys.add((base, amount))

        created = 0
        for rule in rules:
            effective_day = _effective_day_for_month(today.year, today.month, rule.day_of_month)
            target_date = date(today.year, today.month, effective_day)

            if today < target_date:
                continue

            if (rule.description, rule.amount_cents) in existing_keys:
                continue

            db.add(models.Transaction(
                workspace_id=workspace_id,
                category_id=rule.category_id,
                amount_cents=rule.amount_cents,
                description=f"(R) {rule.description}",
                transaction_date=target_date,
                is_installment=False
            ))
            # Marcar para não duplicar entre regras iguais no mesmo lote
            existing_keys.add((rule.description, rule.amount_cents))
            created += 1

        if created > 0:
            db.commit()
    except Exception:
        db.rollback()
        import logging
        logging.getLogger(__name__).warning("Erro ao processar recorrentes automáticas", exc_info=True)

@router.get('/', response_model=List[schemas.TransactionResponse])
async def get_transactions(
    request: Request,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
    workspace: models.Workspace = Depends(get_current_workspace),
):
    limit = min(max(limit, 1), 500)  # Cap entre 1 e 500

    # NOTA: recorrentes automáticas já não são processadas aqui (caminho de leitura);
    # ficam a cargo do job diário. Removido também o COUNT(*) total que só servia para log.

    # Filtrar transações de seed (1 cêntimo) na query SQL; eager loading evita N+1.
    from sqlalchemy.orm import joinedload
    transactions = db.query(models.Transaction).options(
        joinedload(models.Transaction.category)
    ).filter(
        models.Transaction.workspace_id == workspace.id,
        func.abs(models.Transaction.amount_cents) != 1
    ).order_by(models.Transaction.created_at.desc()).offset(skip).limit(limit).all()

    # Modo casal: expor quem registou (só vale a pena com 2+ pessoas no workspace)
    has_members = db.query(models.WorkspaceMember.id).filter(
        models.WorkspaceMember.workspace_id == workspace.id
    ).first() is not None
    out = []
    names: dict = {}
    if has_members:
        user_ids = {t.created_by_user_id for t in transactions if t.created_by_user_id}
        user_ids.add(workspace.owner_id)
        for u in db.query(models.User).filter(models.User.id.in_(user_ids)).all():
            names[u.id] = u.full_name or u.email
    for t in transactions:
        item = schemas.TransactionResponse.from_orm(t)
        if has_members:
            author_id = t.created_by_user_id or workspace.owner_id
            item.created_by_name = names.get(author_id)
        out.append(item)
    return out

@router.post('/', response_model=schemas.TransactionResponse)
@limiter.limit('60/minute')
async def create_transaction(request: Request, transaction_in: schemas.TransactionCreate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    workspace = resolve_user_workspace(db, current_user.id)
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
        workspace_id=workspace.id,
        created_by_user_id=current_user.id,  # modo casal: quem registou
    )
    db.add(new_transaction)
    db.commit()
    db.refresh(new_transaction)
    
    await log_action(db, action='create_transaction', user_id=current_user.id, details=f'amount: {new_transaction.amount_cents}, category_id: {new_transaction.category_id}', request=request)
    return new_transaction


class BulkDeleteRequest(BaseModel):
    ids: List[str]


@router.post('/bulk-delete')
async def bulk_delete_transactions(request: Request, body: BulkDeleteRequest, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    if not body.ids or len(body.ids) == 0:
        raise HTTPException(status_code=400, detail='Nenhuma transação selecionada.')
    if len(body.ids) > 500:
        raise HTTPException(status_code=400, detail='Máximo de 500 transações por operação.')
    workspace = resolve_user_workspace(db, current_user.id)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace não encontrado')
    uuids = []
    for tid in body.ids:
        try:
            uuids.append(UUID(str(tid).strip()))
        except ValueError:
            raise HTTPException(status_code=400, detail=f'ID inválido: {tid}')
    deleted = db.query(models.Transaction).filter(
        models.Transaction.id.in_(uuids),
        models.Transaction.workspace_id == workspace.id
    ).delete(synchronize_session=False)
    db.commit()
    await log_action(db, action='bulk_delete_transactions', user_id=current_user.id, details=f'count: {deleted}, ids: {body.ids[:10]}', request=request)
    return {'message': f'{deleted} transações eliminadas.', 'deleted_count': deleted}


@router.patch('/{transaction_id}', response_model=schemas.TransactionResponse)
@limiter.limit('60/minute')
async def update_transaction(request: Request, transaction_id: UUID, transaction_in: schemas.TransactionUpdate, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    workspace = resolve_user_workspace(db, current_user.id)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace não encontrado')
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

    old_category_id = db_transaction.category_id
    for field, value in update_data.items():
        setattr(db_transaction, field, value)
    
    db.commit()
    db.refresh(db_transaction)

    # Aprendizagem: quando o utilizador corrige a categoria, atualizar token_scores e cache
    if 'category_id' in update_data and db_transaction.description and db_transaction.category_id:
        new_cat_id = db_transaction.category_id
        if new_cat_id != old_category_id:
            try:
                from ..core.categorization_engine import learn_from_correction
                cat = db.query(models.Category).filter(models.Category.id == new_cat_id).first()
                if cat:
                    learn_from_correction(
                        db_transaction.description,
                        new_cat_id,
                        db_transaction.workspace_id,
                        cat.type,
                        cat.name,
                        db,
                        models,
                    )
            except Exception as e:
                import logging
                logging.getLogger("transactions").warning(f"Aprendizagem falhou: {e}")
    
    await log_action(db, action='update_transaction', user_id=current_user.id, details=f'id: {transaction_id}', request=request)
    return db_transaction

@router.delete('/{transaction_id}')
async def delete_transaction(request: Request, transaction_id: UUID, db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    if not current_user.has_effective_pro():
        raise HTTPException(status_code=403, detail="Funcionalidade disponível apenas para utilizadores Pro.")
    workspace = resolve_user_workspace(db, current_user.id)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace não encontrado')
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

@router.get('/export/csv')
@limiter.limit('10/hour')
async def export_csv(
    request: Request,
    period: str = 'this_month',  # this_month, last_month, this_year, all
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Exporta transações em CSV. Período: this_month|last_month|this_year|all"""
    from datetime import datetime, timedelta
    today = date.today()

    if period == 'this_month':
        start = today.replace(day=1)
        end = today
    elif period == 'last_month':
        first_this = today.replace(day=1)
        end = first_this - timedelta(days=1)
        start = end.replace(day=1)
    elif period == 'this_year':
        start = today.replace(month=1, day=1)
        end = today
    else:  # all
        start = date(2000, 1, 1)
        end = today

    workspace = resolve_user_workspace(db, current_user.id)
    if not workspace:
        raise HTTPException(status_code=404, detail='Workspace não encontrado')

    transactions = db.query(models.Transaction).filter(
        models.Transaction.workspace_id == workspace.id,
        models.Transaction.transaction_date >= start,
        models.Transaction.transaction_date <= end,
    ).order_by(models.Transaction.transaction_date.desc()).all()

    # Gerar CSV
    output = io.StringIO()
    writer = csv.writer(output)

    # Cabeçalho
    writer.writerow(['Data', 'Descrição', 'Categoria', 'Valor (€)', 'Tipo', 'Criado por'])

    # Linhas
    for tx in transactions:
        cat_name = db.query(models.Category).filter(models.Category.id == tx.category_id).first()
        cat_name = cat_name.name if cat_name else 'Sem categoria'

        creator = 'Eu'
        if tx.created_by_user_id and tx.created_by_user_id != current_user.id:
            creator_user = db.query(models.User).filter(models.User.id == tx.created_by_user_id).first()
            creator = creator_user.full_name if creator_user else 'Outro'

        amount_eur = abs(tx.amount_cents) / 100
        tx_type = 'Despesa' if tx.amount_cents < 0 else 'Receita'

        writer.writerow([
            tx.transaction_date.isoformat(),
            tx.description,
            cat_name,
            f'{amount_eur:.2f}',
            tx_type,
            creator,
        ])

    # Retornar como download
    content = output.getvalue()
    output.close()

    return StreamingResponse(
        iter([content]),
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename="finly_export_{period}_{today.isoformat()}.csv"'}
    )

