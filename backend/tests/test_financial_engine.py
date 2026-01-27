"""
Testes unitários do Financial Engine: calculate_snapshot, vault, income/expenses, saving_rate.
"""
from datetime import date
from types import SimpleNamespace
from uuid import uuid4

from app.core.financial_engine import FinancialEngine


def _mk_cat(cat_id, type_: str, vault_type: str = "none"):
    return SimpleNamespace(id=cat_id, type=type_, vault_type=vault_type)


def _mk_tx(tx_id, amount_cents: int, category_id, transaction_date: date):
    return SimpleNamespace(
        id=tx_id,
        amount_cents=amount_cents,
        category_id=category_id,
        transaction_date=transaction_date,
    )


def test_snapshot_empty_returns_zeros():
    """Sem transações, snapshot tem income/expenses/vault a zero."""
    snap = FinancialEngine.calculate_snapshot(transactions=[], categories=[])
    assert snap.income == 0.0
    assert snap.expenses == 0.0
    assert snap.vault_total == 0.0
    assert snap.net_worth == 0.0
    assert snap.transaction_count == 0


def test_snapshot_income_only():
    """Só receitas: income positivo, expenses 0, saving_rate 100."""
    cid = uuid4()
    cat = _mk_cat(cid, "income")
    t = _mk_tx(uuid4(), 10000, cid, date.today())  # 100€
    snap = FinancialEngine.calculate_snapshot(transactions=[t], categories=[cat])
    assert snap.income == 100.0
    assert snap.expenses == 0.0
    assert snap.saving_rate == 100.0
    assert snap.transaction_count == 1


def test_snapshot_expenses_only():
    """Só despesas: expenses positivo, income 0."""
    cid = uuid4()
    cat = _mk_cat(cid, "expense")
    t = _mk_tx(uuid4(), -5000, cid, date.today())  # -50€
    snap = FinancialEngine.calculate_snapshot(transactions=[t], categories=[cat])
    assert snap.income == 0.0
    assert snap.expenses == 50.0
    assert snap.transaction_count == 1


def test_snapshot_vault_emergency():
    """Transação em vault emergency aumenta vault_emergency e não income/expenses."""
    cid = uuid4()
    cat = _mk_cat(cid, "expense", "emergency")  # vault
    t = _mk_tx(uuid4(), 20000, cid, date.today())  # +200€ depósito
    snap = FinancialEngine.calculate_snapshot(transactions=[t], categories=[cat])
    assert snap.income == 0.0
    assert snap.expenses == 0.0
    assert snap.vault_emergency == 200.0
    assert snap.vault_total == 200.0


def test_snapshot_vault_investment():
    """Transação em vault investment aumenta vault_investment."""
    cid = uuid4()
    cat = _mk_cat(cid, "expense", "investment")
    t = _mk_tx(uuid4(), 5000, cid, date.today())  # +50€
    snap = FinancialEngine.calculate_snapshot(transactions=[t], categories=[cat])
    assert snap.vault_investment == 50.0
    assert snap.vault_total == 50.0
    assert snap.income == 0.0


def test_snapshot_saving_rate():
    """saving_rate = ((income - expenses) / income) * 100, clamped [-100, 100]."""
    cid_i, cid_e = uuid4(), uuid4()
    cats = [_mk_cat(cid_i, "income"), _mk_cat(cid_e, "expense")]
    tx = [
        _mk_tx(uuid4(), 10000, cid_i, date.today()) ,  # 100€
        _mk_tx(uuid4(), -4000, cid_e, date.today()) ,  # -40€
    ]
    snap = FinancialEngine.calculate_snapshot(transactions=tx, categories=cats)
    assert snap.income == 100.0
    assert snap.expenses == 40.0
    # (100-40)/100 = 60%
    assert snap.saving_rate == 60.0


def test_snapshot_unknown_category_treated_as_expense():
    """Transação com category_id fora da lista trata como despesa."""
    t = _mk_tx(uuid4(), -1000, uuid4(), date.today())  # categoria inexistente
    snap = FinancialEngine.calculate_snapshot(transactions=[t], categories=[])
    assert snap.expenses == 10.0
    assert snap.income == 0.0
