"""Конфигурация приложения на pydantic-settings.

Все настройки читаются из окружения / .env и строго типизируются.
"""

from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent
REPO_ROOT = BACKEND_DIR.parent


class Settings(BaseSettings):
    """Глобальные настройки приложения."""

    model_config = SettingsConfigDict(
        env_file=(REPO_ROOT / ".env", BACKEND_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )

    # --- Application ---
    APP_ENV: Literal["development", "staging", "production", "test"] = "development"
    DEBUG: bool = False
    LOG_LEVEL: str = "INFO"

    # --- HTTP ---
    # Принимаем как строку (через запятую) — иначе pydantic-settings требует JSON.
    CORS_ORIGINS_RAW: str = Field(
        default="http://localhost:5173,http://localhost:3000",
        alias="CORS_ORIGINS",
    )
    MAX_UPLOAD_MB: int = 50

    @property
    def CORS_ORIGINS(self) -> list[str]:  # noqa: N802
        return [x.strip() for x in self.CORS_ORIGINS_RAW.split(",") if x.strip()]

    # --- Database ---
    DATABASE_URL: str = Field(
        default_factory=lambda: f"sqlite:///{BACKEND_DIR / 'nsi_data.db'}",
    )

    # --- Auth / JWT ---
    JWT_SECRET_KEY: str = "change-me-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_TTL_MINUTES: int = 60 * 24

    ADMIN_EMAIL: str | None = None
    ADMIN_PASSWORD: str | None = None

    # --- Yandex AI Studio ---
    YANDEX_API_KEY: str = ""
    YANDEX_IDENTIFICATOR: str = ""  # folder_id
    MODEL_URL: str = ""
    VECTOR_STORE_IDENTIFICATOR: str = ""

    # Aliases kept for backward compatibility with legacy code paths.
    @property
    def YANDEX_FOLDER_ID(self) -> str:
        return self.YANDEX_IDENTIFICATOR

    @property
    def YANDEX_MODEL_URL(self) -> str:
        return self.MODEL_URL

    @property
    def YANDEX_VECTOR_STORE_ID(self) -> str:
        return self.VECTOR_STORE_IDENTIFICATOR

    # --- MinerU ---
    MINERU_API_KEY: str = ""

    # --- Paths ---
    UPLOAD_DIR: str = str(BACKEND_DIR / "app" / "uploads")
    SEED_DATA_DIR: str = str(REPO_ROOT / "ДОКУМЕНТЫ ДЛЯ РАБОТЫ")

    @property
    def is_production(self) -> bool:
        return self.APP_ENV == "production"


settings = Settings()
