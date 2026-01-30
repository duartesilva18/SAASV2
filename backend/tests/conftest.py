"""
Fixtures para testes: DB com rollback por teste, client com override de get_db.
Executar de dentro de backend/: pytest tests/ -v
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import sessionmaker
from sqlalchemy import create_engine

# Importar app depois de eventual configuração de test env
from app.main import app
from app.core.dependencies import get_db, engine
from app.models import database as models
from app.core import security


@pytest.fixture(scope="function")
def db_session():
    """Sessão por teste; rollback no fim para não persistir dados."""
    connection = engine.connect()
    transaction = connection.begin()
    SessionLocal = sessionmaker(bind=connection, expire_on_commit=False)
    session = SessionLocal()
    yield session
    session.close()
    transaction.rollback()
    connection.close()


@pytest.fixture(scope="function")
def client(db_session):
    """TestClient com get_db override para usar a sessão do fixture (rollback no fim)."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def test_user(db_session):
    """Utilizador verificado para testes de auth e transações."""
    user = models.User(
        email="test@example.com",
        password_hash=security.get_password_hash("TestPass123"),
        is_email_verified=True,
        currency="EUR",
        is_onboarded=True,
    )
    db_session.add(user)
    db_session.commit()
    db_session.refresh(user)
    return user


@pytest.fixture
def test_user_token(test_user):
    """Token de acesso para test_user (evita rate limit do login nos testes)."""
    return security.create_access_token(subject=test_user.email)
