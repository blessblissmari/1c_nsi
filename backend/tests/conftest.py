"""Общие фикстуры pytest."""

from __future__ import annotations

import os
import sys
import tempfile
from collections.abc import Generator
from pathlib import Path

import pytest

BACKEND_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BACKEND_DIR))


@pytest.fixture(scope="session", autouse=True)
def _env_setup() -> Generator[None, None, None]:
    db_fd, db_path = tempfile.mkstemp(suffix=".db")
    os.close(db_fd)
    os.environ.update(
        {
            "APP_ENV": "test",
            "DEBUG": "true",
            "DATABASE_URL": f"sqlite:///{db_path}",
            "JWT_SECRET_KEY": "test-secret-key-change-me",
            "JWT_ACCESS_TOKEN_TTL_MINUTES": "60",
            "YANDEX_API_KEY": "",
            "CORS_ORIGINS": "http://testserver",
        }
    )
    yield
    try:
        os.unlink(db_path)
    except FileNotFoundError:
        pass


@pytest.fixture()
def client(request):
    """FastAPI TestClient с изолированной SQLite-БД на тест.

    Лимитер по умолчанию отключён. Тесты, которые хотят его проверить,
    должны маркироваться `pytest.mark.rate_limited`.
    """
    from fastapi.testclient import TestClient

    # Важно: импорт после того, как выставлены ENV.
    from app.database import Base, engine
    from app.main import app
    from app.rate_limit import limiter

    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    marker = request.node.get_closest_marker("rate_limited")
    limiter.reset()
    limiter.enabled = bool(marker)

    with TestClient(app) as c:
        yield c

    Base.metadata.drop_all(bind=engine)
    limiter.enabled = True
    limiter.reset()


def pytest_configure(config):
    config.addinivalue_line("markers", "rate_limited: включить лимитер для теста")
