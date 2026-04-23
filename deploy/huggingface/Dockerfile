# Dockerfile для Hugging Face Spaces (Docker SDK).
# HF Spaces слушают порт 7860, все env передаются через Settings → Variables/Secrets.
#
# Как использовать:
# 1. Создайте Space: https://huggingface.co/new-space → SDK "Docker" → Blank template.
# 2. Склонируйте его: `git clone https://huggingface.co/spaces/<user>/<space>`
# 3. Из этого репо скопируйте содержимое `backend/` в корень Space-репозитория,
#    а этот файл положите как `Dockerfile`:
#        rsync -a --delete ../1c_nsi/backend/ ./
#        cp ../1c_nsi/deploy/huggingface/Dockerfile ./Dockerfile
#        cp ../1c_nsi/deploy/huggingface/README.md ./README.md
# 4. Закоммитьте и запушьте в HF (git push).
# 5. В Settings Space добавьте переменные: YANDEX_API_KEY, YANDEX_IDENTIFICATOR,
#    MODEL_URL, VECTOR_STORE_IDENTIFICATOR, JWT_SECRET_KEY, CORS_ORIGINS.

FROM python:3.12-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=7860

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential libpq-dev curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt ./
RUN pip install -r requirements.txt

COPY . .

# На HF Spaces контейнер запускается от произвольного UID, поэтому папки должны
# быть доступны всем на запись.
RUN mkdir -p /app/app/uploads /data \
    && chmod -R 777 /app/app/uploads /data

ENV UPLOAD_DIR=/app/app/uploads \
    DATABASE_URL=sqlite:////data/nsi.db

EXPOSE 7860

CMD ["sh", "-c", "alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port ${PORT}"]
