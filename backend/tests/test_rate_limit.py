"""Прогон rate-limiter'а на auth-эндпоинтах."""

from __future__ import annotations

import pytest


@pytest.mark.rate_limited
def test_register_rate_limit(client):
    """После 5 регистраций в минуту возвращается 429."""
    statuses = []
    for i in range(7):
        r = client.post(
            "/api/v1/auth/register",
            json={"email": f"rl{i}@example.com", "password": "password1"},
        )
        statuses.append(r.status_code)
    assert 429 in statuses, statuses
