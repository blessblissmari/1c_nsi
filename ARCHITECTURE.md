# Архитектура «Инструмент НСИ»

Документ описывает верхнеуровневую архитектуру системы и ключевые
решения. Подробные требования — в `ТЗ/ТЗ на Инструмент НСИ 06.04.2026.txt`.

## Высокоуровневая диаграмма

```
┌────────────────────────┐        ┌──────────────────────────┐
│  Frontend (React/Vite) │ <────> │  Backend (FastAPI)       │
│  nginx (prod)          │  JWT   │  ┌────────────────────┐  │
└────────────────────────┘        │  │  API v1 (routers)  │  │
                                  │  ├────────────────────┤  │
                                  │  │  Services          │  │
                                  │  │  - normalization   │  │
                                  │  │  - classification  │  │
                                  │  │  - file_parser     │  │
                                  │  │  - ai_service      │  │
                                  │  │  - analogs         │  │
                                  │  └────────────────────┘  │
                                  └──┬─────────────┬─────────┘
                                     │             │
                                     ▼             ▼
                           ┌─────────────┐   ┌──────────────────────┐
                           │  Postgres   │   │  Yandex AI Studio    │
                           │             │   │  - Vector Store (RAG)│
                           └─────────────┘   │  - File search       │
                                             │  - Web search API    │
                                             └──────────────────────┘
```

## Слои backend

1. **API v1** (`app/api/v1/`) — тонкий слой роутеров, один файл на окно
   концепции: `hierarchy`, `upper_levels`, `mass_processing`,
   `maintenance`, `tk`, `specifications`, `reliability`, `chat`, `parser`.
2. **Services** (`app/services/`) — бизнес-логика:
   - `normalization` — детерминированные правила нормализации
     наименований моделей/классов/операций по ТЗ 8.
   - `classification` — классификация по загруженному классификатору
     + fallback на именовое сопоставление + LLM-fallback.
   - `ai_service` — обёртка вокруг Yandex AI Studio SDK (LLM, Vector
     Store, Web Search). HTTP fallback + лайт-модель.
   - `file_parser` — универсальный парсер xlsx/pdf/docx/txt с
     маршрутизацией по MIME.
   - `analogs` — поиск аналогов моделей и ТМЦ.
3. **Models** (`app/models/models.py`) — декларативная модель SQLAlchemy.
4. **Schemas** (`app/schemas/schemas.py`) — Pydantic v2 DTO.
5. **Auth** (`app/auth/`) — JWT, bcrypt, зависимости
   `get_current_user` / `require_admin`.
6. **Config** (`app/config.py`) — pydantic-settings: читает `.env`,
   валидирует типы.

## Безопасность

- Пароли: bcrypt (passlib).
- Токены: HS256 JWT с временем жизни из конфига (`JWT_ACCESS_TOKEN_TTL_MINUTES`).
- Все `/api/v1/*` кроме `auth`, `health`, `readyz` требуют валидный
  токен через `Authorization: Bearer …`.
- Rate limiting: SlowAPI на `/auth/login` и `/auth/register`, а также
  на долгие enrichment-эндпоинты.
- Файлы: ограничение `MAX_UPLOAD_MB` (проверяется в middleware и в
  каждом `UploadFile`-хендлере).

## Хранилище

- Dev: SQLite (WAL + `busy_timeout=30s`).
- Prod: PostgreSQL 16. Схема одинаковая, миграции через Alembic.
- Политика миграций: любая схема БД меняется только через
  `alembic revision --autogenerate`.

## Интеграция с Yandex AI

`YandexAIService` — единая точка входа ко всем LLM/RAG-вызовам:

- `_call_http` — прямой HTTP-POST на
  `https://llm.api.cloud.yandex.net/v1/chat/completions` (OpenAI-совместимый).
- `_call_lite` — fallback на `yandexgpt-lite` через SDK.
- `classify_model_via_web_search` — двухшаговый поиск + LLM-выбор
  из загруженного классификатора.
- `web_search` — обёртка над `sdk.search_api.web` для RU-поиска.
- `file_search` / Vector Store — для RAG по загруженным документам
  к моделям оборудования.

## CI/CD

GitHub Actions (`.github/workflows/ci.yml`) параллельно:

- **backend-lint**: ruff + ruff-format --check + mypy
- **backend-test**: pytest с SQLite-фикстурой
- **frontend-lint**: `npm run lint`
- **frontend-build**: `npm run build` (tsc + vite build)
- **docker-build**: сборка обоих образов (smoke-test Dockerfile'ов)

Для продакшен-деплоя предусмотрен отдельный workflow
(`deploy.yml`, вручную), собирающий образы и пушащий их в
Yandex Container Registry / GHCR.

## Чего сейчас НЕТ (задел на будущее)

- Сквозная RBAC (сейчас только admin/user).
- Фоновая очередь задач (долгие LLM-обогащения идут синхронно —
  при росте нагрузки нужен Celery/Arq + Redis).
- Мультитенантность (см. `ROADMAP.md`).
- Метрики/трейсинг (Prometheus/OTel — TODO).
