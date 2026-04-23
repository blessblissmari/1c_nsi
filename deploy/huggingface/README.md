---
title: NSI Backend
emoji: 🛠️
colorFrom: blue
colorTo: indigo
sdk: docker
app_port: 7860
pinned: false
license: mit
---

# Инструмент НСИ — Backend

FastAPI-бэкенд для системы нормативно-справочной информации ТОиР.
Документация и UI: <https://github.com/blessblissmari/1c_nsi>.

## Переменные окружения

Настраиваются в **Space settings → Variables and secrets**:

| Ключ | Обязательный | Описание |
|---|---|---|
| `JWT_SECRET_KEY` | ✅ | Длинная случайная строка (`python -c "import secrets; print(secrets.token_urlsafe(64))"`) |
| `CORS_ORIGINS` | ✅ | Через запятую: origin'ы фронтенда (например `https://<user>.github.io`) |
| `YANDEX_API_KEY` | ⚠️ | Для AI-функций (иначе работает только базовая часть) |
| `YANDEX_IDENTIFICATOR` | ⚠️ | Folder ID из Yandex Cloud |
| `MODEL_URL` | ⚠️ | `gpt://…/yandexgpt/latest` |
| `VECTOR_STORE_IDENTIFICATOR` | ⚠️ | ID Vector Store |
| `APP_ENV` | — | По умолчанию `production` |
| `LOG_LEVEL` | — | По умолчанию `INFO` |

## Health check

```
GET /api/v1/health   → 200 {"status":"ok"}
GET /api/v1/readyz   → 200 если БД доступна
```

## Первый пользователь

Первый `POST /api/v1/auth/register` автоматически становится администратором.

```bash
curl -X POST https://<user>-<space>.hf.space/api/v1/auth/register \
     -H 'Content-Type: application/json' \
     -d '{"email":"admin@example.com","password":"<strong-password>"}'
```
