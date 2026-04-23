import os
from dotenv import load_dotenv
from pathlib import Path

load_dotenv(Path(__file__).resolve().parent.parent.parent / ".env")


class Settings:
    YANDEX_API_KEY: str = os.getenv("YANDEX_API_KEY", "")
    YANDEX_FOLDER_ID: str = os.getenv("YANDEX_IDENTIFICATOR", "")
    YANDEX_MODEL_URL: str = os.getenv("MODEL_URL", "")
    YANDEX_VECTOR_STORE_ID: str = os.getenv("VECTOR_STORE_IDENTIFICATOR", "")
    MINERU_API_KEY: str = os.getenv("MINERU_API_KEY", "")

    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        f"sqlite:///{Path(__file__).resolve().parent.parent / 'nsi_data.db'}",
    )

    UPLOAD_DIR: str = str(Path(__file__).resolve().parent / "uploads")
    SEED_DATA_DIR: str = str(
        Path(__file__).resolve().parent.parent.parent / "ДОКУМЕНТЫ ДЛЯ РАБОТЫ"
    )

    CORS_ORIGINS: list[str] = os.getenv(
        "CORS_ORIGINS", "http://localhost:5173,http://localhost:3000"
    ).split(",")


settings = Settings()
