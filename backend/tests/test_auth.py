"""
Testes de autenticação: login, credenciais, token.
"""
import pytest
from fastapi import status


def test_login_success(client, test_user):
    """Login com email/password correctos devolve token."""
    r = client.post(
        "/auth/login",
        data={"username": test_user.email, "password": "TestPass123"},
    )
    assert r.status_code == status.HTTP_200_OK
    data = r.json()
    assert "access_token" in data
    assert data.get("token_type") == "bearer"


def test_login_wrong_password(client, test_user):
    """Login com password errada devolve 401."""
    r = client.post(
        "/auth/login",
        data={"username": test_user.email, "password": "WrongPass123"},
    )
    assert r.status_code == status.HTTP_401_UNAUTHORIZED


def test_login_nonexistent_user(client):
    """Login com email inexistente devolve 401."""
    r = client.post(
        "/auth/login",
        data={"username": "nobody@example.com", "password": "AnyPass123"},
    )
    assert r.status_code == status.HTTP_401_UNAUTHORIZED


def test_protected_route_without_token(client):
    """Rota protegida sem token devolve 401."""
    r = client.get("/transactions/")
    assert r.status_code == status.HTTP_401_UNAUTHORIZED


def test_protected_route_with_token(client, test_user_token):
    """Rota protegida com token válido acede (pode 404 se não houver workspace)."""
    r = client.get(
        "/transactions/",
        headers={"Authorization": f"Bearer {test_user_token}"},
    )
    # 200 com lista ou 404 se não houver workspace
    assert r.status_code in (status.HTTP_200_OK, status.HTTP_404_NOT_FOUND)
