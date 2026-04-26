"""Тесты аутентификации."""

from __future__ import annotations


def test_register_first_user_becomes_admin(client):
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "admin@example.com", "password": "secret123", "full_name": "Admin"},
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["email"] == "admin@example.com"
    assert body["is_admin"] is True
    assert body["is_active"] is True


def test_register_second_user_is_not_admin(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "a@example.com", "password": "password1"},
    )
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "b@example.com", "password": "password1"},
    )
    assert r.status_code == 201
    assert r.json()["is_admin"] is False


def test_register_duplicate_conflict(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "dup@example.com", "password": "password1"},
    )
    r = client.post(
        "/api/v1/auth/register",
        json={"email": "dup@example.com", "password": "password1"},
    )
    assert r.status_code == 409


def test_login_and_me(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "u@example.com", "password": "password1"},
    )

    r = client.post(
        "/api/v1/auth/login",
        json={"email": "u@example.com", "password": "password1"},
    )
    assert r.status_code == 200, r.text
    token = r.json()["access_token"]
    assert token

    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "u@example.com"


def test_login_wrong_password(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "x@example.com", "password": "password1"},
    )
    r = client.post(
        "/api/v1/auth/login",
        json={"email": "x@example.com", "password": "wrong-password"},
    )
    assert r.status_code == 401


def test_protected_endpoint_requires_auth(client):
    r = client.get("/api/v1/hierarchy/tree")
    assert r.status_code == 401


def test_protected_endpoint_with_token_ok(client):
    client.post(
        "/api/v1/auth/register",
        json={"email": "y@example.com", "password": "password1"},
    )
    token = client.post(
        "/api/v1/auth/login",
        json={"email": "y@example.com", "password": "password1"},
    ).json()["access_token"]

    r = client.get("/api/v1/hierarchy/tree", headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_health_is_public(client):
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json()["status"] == "ok"


def test_readyz(client):
    r = client.get("/api/v1/readyz")
    assert r.status_code == 200
