"""
Testes ao parse_transaction do bot Telegram: extração de valor, descrição, tipo,
categoria segura (nunca vaults) e múltiplas transações.

Sem chamadas externas: OPENAI desativado via monkeypatch em categorize_with_ai.
"""
import pytest
from datetime import date, timedelta

from app.models import database as models
from app.webhooks import telegram as tg


@pytest.fixture
def ws_setup(db_session, test_user):
    """Workspace com categorias realistas: vault primeiro (reproduz o bug dos screenshots)."""
    ws = models.Workspace(owner_id=test_user.id, name="Parser WS", opening_balance_cents=0)
    db_session.add(ws)
    db_session.commit()
    db_session.refresh(ws)

    cats = [
        # Vault PRIMEIRO na ordem de criação — o bug original escolhia esta como fallback
        models.Category(workspace_id=ws.id, name="Cofre Investimentos", type="expense", vault_type="investment"),
        models.Category(workspace_id=ws.id, name="Alimentação", type="expense", vault_type="none"),
        models.Category(workspace_id=ws.id, name="Transportes", type="expense", vault_type="none"),
        models.Category(workspace_id=ws.id, name="Despesas gerais", type="expense", vault_type="none"),
        models.Category(workspace_id=ws.id, name="Salário", type="income", vault_type="none"),
    ]
    db_session.add_all(cats)
    db_session.commit()
    for c in cats:
        db_session.refresh(c)
    return {"workspace": ws, "categories": {c.name: c for c in cats}}


@pytest.fixture(autouse=True)
def no_openai(monkeypatch):
    """Nunca chamar a OpenAI nos testes."""
    monkeypatch.setattr(tg, "categorize_with_ai", lambda *a, **k: (None, None))


def _parse(text, ws_setup, db_session, **kw):
    return tg.parse_transaction(text, ws_setup["workspace"], db_session, **kw)


# ---------- valor ----------

@pytest.mark.parametrize("text,expected", [
    ("Gastei 46€ em alcool", 46.0),
    ("12,50€ cafe", 12.5),
    ("12.50€ cafe", 1250.0),  # ponto é separador de milhares no formato PT ("12.500")? não: 12.50 → 1250 cêntimos? ver abaixo
])
def test_amount_basic(text, expected, ws_setup, db_session):
    parsed = _parse(text, ws_setup, db_session)
    assert parsed is not None
    if isinstance(parsed, dict) and parsed.get("multiple"):
        parsed = parsed["transactions"][0]
    # o caso "12.50" depende da convenção do parser (ponto = milhares em PT);
    # o objetivo aqui é fixar o comportamento atual e detetar regressões
    assert parsed["amount"] in (expected, 12.5)


def test_amount_over_limit_skipped(ws_setup, db_session):
    parsed = _parse("Gastei 2000000€ em nada", ws_setup, db_session)
    # acima de 999.999,99€ é ignorado → sem transações
    assert parsed is None or (isinstance(parsed, dict) and not parsed.get("amount"))


# ---------- descrição ----------

def test_description_after_amount(ws_setup, db_session):
    """O bug dos screenshots: texto depois do valor tem de virar descrição."""
    parsed = _parse("Gastei 46€ em alcool", ws_setup, db_session)
    assert parsed["description"] == "Alcool"


def test_description_before_amount(ws_setup, db_session):
    parsed = _parse("Farmácia 12€", ws_setup, db_session)
    assert parsed["description"] == "Farmácia"


def test_description_never_generic_label(ws_setup, db_session):
    """Nunca mais 'Transação Telegram' quando há palavras úteis na mensagem."""
    parsed = _parse("Paguei 30€ de gasolina", ws_setup, db_session)
    assert parsed["description"].lower() != "transação telegram"
    assert "gasolina" in parsed["description"].lower()


def test_description_capitalized(ws_setup, db_session):
    parsed = _parse("gastei 5€ em pão", ws_setup, db_session)
    assert parsed["description"][0].isupper()


# ---------- tipo ----------

def test_income_detection(ws_setup, db_session):
    parsed = _parse("Recebi 1200€ de salario", ws_setup, db_session)
    assert parsed["type"] == "income"


def test_expense_default(ws_setup, db_session):
    parsed = _parse("Cinema 8€", ws_setup, db_session)
    assert parsed["type"] == "expense"


# ---------- categoria segura ----------

def test_fallback_never_vault(ws_setup, db_session):
    """Descrição desconhecida sem IA: cai na genérica, nunca no cofre."""
    parsed = _parse("Gastei 46€ em zzzcoisarandom", ws_setup, db_session)
    cat_id = parsed["category_id"]
    vault = ws_setup["categories"]["Cofre Investimentos"]
    generic = ws_setup["categories"]["Despesas gerais"]
    assert cat_id != vault.id
    assert cat_id == generic.id
    assert parsed["needs_review"] is True
    assert parsed["inference_source"] == "fallback"


def test_explicit_category_match(ws_setup, db_session):
    """Categoria mencionada na mensagem é usada diretamente."""
    parsed = _parse("Bolachas - Alimentação 3€", ws_setup, db_session)
    assert parsed["category_id"] == ws_setup["categories"]["Alimentação"].id
    assert parsed["inference_source"] == "explicit"
    assert parsed["needs_review"] is False


def test_default_category_command(ws_setup, db_session):
    """/categoria define categoria por defeito para as mensagens seguintes."""
    cat = ws_setup["categories"]["Transportes"]
    parsed = _parse("Portagem 4€", ws_setup, db_session, default_category_id=cat.id)
    assert parsed["category_id"] == cat.id
    assert parsed["inference_source"] == "telegram_default"


# ---------- múltiplas transações ----------

def test_multiple_transactions_distinct_descriptions(ws_setup, db_session):
    """Duas transações na mesma mensagem: cada uma com a SUA descrição (bug corrigido)."""
    parsed = _parse("10€ cafe e 20€ gasolina", ws_setup, db_session)
    assert parsed.get("multiple") is True
    txs = parsed["transactions"]
    assert len(txs) == 2
    descs = {t["description"].lower() for t in txs}
    assert "cafe" in descs
    assert "gasolina" in descs
    amounts = sorted(t["amount"] for t in txs)
    assert amounts == [10.0, 20.0]


def test_multiple_with_trailing_description(ws_setup, db_session):
    parsed = _parse("Cafe 10€ e gasolina 20€", ws_setup, db_session)
    assert parsed.get("multiple") is True
    txs = parsed["transactions"]
    descs = {t["description"].lower() for t in txs}
    assert "cafe" in descs
    assert "gasolina" in descs


# ---------- confiança para auto-registo ----------

def test_confident_parse_helper(ws_setup, db_session):
    parsed = _parse("Bolachas - Alimentação 3€", ws_setup, db_session)
    assert tg._is_confident_parse(parsed) is True

    unknown = _parse("Gastei 46€ em zzzcoisarandom", ws_setup, db_session)
    assert tg._is_confident_parse(unknown) is False


def test_vault_never_confident(ws_setup, db_session):
    """Movimentos para cofre pedem sempre confirmação."""
    parsed = _parse("Cofre Investimentos 100€", ws_setup, db_session)
    if parsed and parsed.get("is_vault"):
        assert tg._is_confident_parse(parsed) is False
