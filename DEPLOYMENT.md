# Деплой «Инструмент НСИ»

Система состоит из двух независимых частей: статический **frontend** и долгоживущий **backend** + БД. Дальше — бесплатные варианты для каждого.

## Frontend → GitHub Pages (бесплатно, рекомендуемый вариант)

В репо уже лежит workflow <ref_file file="/home/ubuntu/repos/1c_nsi/.github/workflows/deploy-frontend.yml" /> — автоматом собирает фронт и публикует на Pages при каждом push в `main`.

### Шаги

1. **Включить Pages**: Settings → Pages → Source = **GitHub Actions**.
2. **Указать URL бэкенда**: Settings → Secrets and variables → Actions → **Variables** → `New repository variable`:
   - Name: `VITE_API_URL`
   - Value: URL развернутого бэкенда, без `/api/v1` (например `https://nsi-backend-user.hf.space` или `https://nsi-backend.fly.dev`).
3. Сделать любой коммит в `frontend/` или вручную запустить workflow `Actions → Deploy frontend to GitHub Pages → Run workflow`.
4. Через ~2 минуты фронт доступен по `https://<user>.github.io/<repo>/`.

### Что делает workflow

- `npm ci` + `npm run build` с переменными `VITE_API_URL`, `VITE_USE_HASH_ROUTER=true`, `VITE_BASE_PATH=/<repo-name>/`.
- Копирует `index.html` как `404.html` — spa-fallback для HashRouter не нужен, но этот приём страхует от деплоя на кастомный домен без хэша.
- Деплоит `dist/` через `actions/deploy-pages@v4`.

### Ограничения GitHub Pages

- Только статика; любые серверные вызовы (`/api/*`) идут на внешний бэкенд по `VITE_API_URL`.
- Нужно, чтобы бэкенд разрешал origin GitHub Pages в `CORS_ORIGINS` (см. ниже).
- Используется `HashRouter` — URL вида `https://.../#/hierarchy`.

## Backend — выберите один вариант

### A. Hugging Face Spaces (Docker, 100% бесплатно, без карты)

См. <ref_file file="/home/ubuntu/repos/1c_nsi/deploy/huggingface/README.md" />. Коротко:

1. <https://huggingface.co/new-space> → SDK: **Docker** → Blank template → создать.
2. Склонировать Space-репо: `git clone https://huggingface.co/spaces/<user>/<space>`.
3. Скопировать в него содержимое `backend/` + `deploy/huggingface/Dockerfile` как `Dockerfile` + `deploy/huggingface/README.md` как `README.md`.
4. `git add -A && git commit -m "init" && git push`.
5. Settings → Variables and secrets: добавить `JWT_SECRET_KEY`, `CORS_ORIGINS=https://<user>.github.io`, Yandex-ключи (если есть).
6. URL: `https://<user>-<space>.hf.space` — это и есть ваш `VITE_API_URL`.

**Плюсы:** полностью бесплатно, не требует карты. 16 GB RAM, persistent disk на `/data`.
**Минусы:** засыпает после 48ч бездействия (нужен первый заход).

### B. Fly.io (free allowance, нужна карта для подтверждения)

Конфиг: <ref_file file="/home/ubuntu/repos/1c_nsi/deploy/fly/fly.toml" />. Команды внутри файла.

**Плюсы:** быстро, persistent volume, автомасштабирование.
**Минусы:** просит карту при регистрации (деньги не списывают в рамках free allowance: 3 × shared-cpu-1x / 256 MB).

### C. Render.com (Blueprint, web-сервис платный с 2024)

Конфиг: <ref_file file="/home/ubuntu/repos/1c_nsi/render.yaml" />. Кнопка:
`https://render.com/deploy?repo=https://github.com/<user>/1c_nsi`

**Минусы:** бесплатный тариф web-сервиса убрали — от $7/мес. Оставлено для полноты.

## После деплоя бэкенда

1. Скопируйте URL бэкенда (например `https://user-nsi.hf.space`).
2. GitHub → Settings → Secrets and variables → Actions → **Variables** → создать `VITE_API_URL` с этим URL.
3. На бэкенде в env: `CORS_ORIGINS=https://<user>.github.io` (можно через запятую несколько).
4. В Actions запустите workflow `Deploy frontend to GitHub Pages` вручную (или любым коммитом).
5. Зайдите на `https://<user>.github.io/<repo>/`, пройдите `/register` — первый пользователь становится админом.

## Проверка работоспособности

```bash
# Backend жив
curl https://<backend>/api/v1/health          # {"status":"ok"}
curl https://<backend>/api/v1/readyz          # {"status":"ready"} если БД ок

# Регистрация первого пользователя (он же админ)
curl -X POST https://<backend>/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"strong-password-here"}'

# Логин
curl -X POST https://<backend>/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@example.com","password":"strong-password-here"}'
```
