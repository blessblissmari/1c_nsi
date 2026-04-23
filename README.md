# Инструмент НСИ

Единая функциональная платформа для работы с нормативно-справочной
информацией (НСИ) в области ТОиР. Объединяет загрузку и обогащение
справочников оборудования, классификацию, формирование технологических
карт и спецификаций, а также поиск аналогов — в том числе с помощью
LLM/RAG на базе Yandex AI Studio.

Концепция и ТЗ хранятся в каталоге [`ТЗ/`](ТЗ/). Эталонные справочники
для сидирования — в [`ДОКУМЕНТЫ ДЛЯ РАБОТЫ/`](ДОКУМЕНТЫ%20ДЛЯ%20РАБОТЫ/).

## Стек

| Слой     | Технологии |
|----------|------------|
| Backend  | Python 3.12, FastAPI, SQLAlchemy 2.0, Alembic, Pydantic v2, Uvicorn, Loguru, Passlib/bcrypt, PyJWT, SlowAPI |
| Хранилище| SQLite (dev) / PostgreSQL (prod) |
| AI       | `yandex-ai-studio-sdk` (Vector Store RAG, file_search, Web Search API), MinerU для PDF |
| Frontend | React 19, Vite, TypeScript, TailwindCSS, zustand, react-router, react-hook-form + zod, ky, @tanstack/react-table, framer-motion |
| Инфра    | Docker, docker-compose (dev + prod), GitHub Actions CI |

## Быстрый старт локально

```bash
# 1. Клон и переменные окружения
git clone https://github.com/blessblissmari/1c_nsi.git
cd 1c_nsi
cp .env.example .env                  # заполните YANDEX_* и JWT_SECRET_KEY

# 2a. Режим docker-compose (рекомендуется)
docker compose up --build             # поднимает postgres, backend (8000), frontend (3000)

# 2b. Режим «руками»
python3.12 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt -r backend/requirements-dev.txt
alembic -c backend/alembic.ini upgrade head
python -m app.seed                     # из backend/, загружает справочники из "ДОКУМЕНТЫ ДЛЯ РАБОТЫ"
uvicorn app.main:app --reload --port 8000

cd frontend
npm install
npm run dev                            # http://localhost:5173
```

API становится доступен на `http://localhost:8000`, документация Swagger —
на `http://localhost:8000/docs`.

## Аутентификация

Все `/api/v1/*` (кроме `health`, `readyz`, `auth/*`) защищены JWT.

```bash
# Регистрация (открыта, если нет админа; иначе только администратор)
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"secret12","full_name":"User"}'

# Получение токена
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"secret12"}'
# -> {"access_token":"...","token_type":"bearer"}

# Использование
curl http://localhost:8000/api/v1/hierarchy/tree \
  -H 'Authorization: Bearer <token>'
```

Первого администратора удобно создать скриптом:

```bash
python -m app.seed --admin              # использует ADMIN_EMAIL / ADMIN_PASSWORD из .env
```

## Миграции БД

```bash
# создать новую миграцию из моделей
alembic -c backend/alembic.ini revision --autogenerate -m "описание"

# применить все миграции
alembic -c backend/alembic.ini upgrade head

# откат
alembic -c backend/alembic.ini downgrade -1
```

## Тесты / линт

```bash
# Backend
cd backend
ruff check .
ruff format --check .
mypy app
pytest -q

# Frontend
cd frontend
npm run lint
npm run build         # tsc + vite build
```

Все эти команды запускаются в CI на каждый push/PR
(`.github/workflows/ci.yml`).

## Деплой (Yandex Cloud Compute + Object Storage)

Готов `docker-compose.prod.yml`:

```bash
# на production VM
docker compose -f docker-compose.prod.yml up -d --build
```

В production:

- Postgres в отдельном сервисе/managed-инстансе
- backend по `8000`, за nginx (tls terminator)
- frontend — статика из multi-stage nginx-образа
- секреты — только через ENV / managed secrets
- алембик-миграции поднимаются одноразовым init-container'ом (`migrate`)

## Архитектура

- Подробности в [`ARCHITECTURE.md`](ARCHITECTURE.md)
- Дорожная карта по этапам — в [`ROADMAP.md`](ROADMAP.md)

## Структура проекта

```
.
├── backend/
│   ├── alembic/                 # миграции
│   ├── app/
│   │   ├── api/v1/              # FastAPI-роутеры по окнам концепции
│   │   ├── services/            # бизнес-логика (normalization, AI, парсинг)
│   │   ├── models/              # SQLAlchemy модели
│   │   ├── schemas/             # Pydantic-схемы
│   │   ├── auth/                # JWT + пользователи
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── main.py
│   │   └── seed.py
│   ├── tests/                   # pytest
│   ├── requirements.txt
│   └── requirements-dev.txt
├── frontend/
│   └── src/
│       ├── api/                 # ky-клиенты
│       ├── auth/                # login/хранилище токена
│       ├── components/
│       │   ├── layout/
│       │   ├── ui/
│       │   └── workspaces/      # по одному на окно концепции
│       └── store/
├── ДОКУМЕНТЫ ДЛЯ РАБОТЫ/         # эталонные xlsx для сида
├── ТЗ/                          # концепция и бэклог
├── docker-compose.yml
├── docker-compose.prod.yml
├── .github/workflows/ci.yml
├── .pre-commit-config.yaml
└── README.md
```

## Лицензия

Проприетарный код ООО «Простоев.Нет». Для внутреннего использования.
