"""
Testes de transações: listagem com auth, workspace.
"""
import pytest
from datetime import date

from app.models import database as models


@pytest.fixture
def workspace_and_categories(db_session, test_user):
    """Workspace e categorias para o test_user."""
    ws = models.Workspace(owner_id=test_user.id, name="Test WS", opening_balance_cents=0)
    db_session.add(ws)
    db_session.commit()
    db_session.refresh(ws)

    cat_income = models.Category(
        workspace_id=ws.id, name="Salário", type="income", vault_type="none"
    )
    cat_expense = models.Category(
        workspace_id=ws.id, name="Comida", type="expense", vault_type="none"
    )
    db_session.add_all([cat_income, cat_expense])
    db_session.commit()
    db_session.refresh(cat_income)
    db_session.refresh(cat_expense)

    return {
        "workspace": ws,
        "categories": [cat_income, cat_expense],
    }


def test_get_transactions_empty(client, test_user_token, workspace_and_categories):
    """GET /transactions/ com workspace vazio devolve lista vazia."""
    r = client.get(
        "/transactions/",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) == 0


def test_get_transactions_returns_list(client, test_user_token, workspace_and_categories, db_session):
    """GET /transactions/ devolve lista (com ou sem itens)."""
    ws = workspace_and_categories["workspace"]
    cat = workspace_and_categories["categories"][0]
    tx = models.Transaction(
        workspace_id=ws.id,
        category_id=cat.id,
        amount_cents=-1500,
        description="Almoço",
        transaction_date=date.today(),
        is_installment=False,
    )
    db_session.add(tx)
    db_session.commit()

    r = client.get(
        "/transactions/",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    first = data[0]
    assert "id" in first
    assert "amount_cents" in first
    assert first["amount_cents"] == -1500
