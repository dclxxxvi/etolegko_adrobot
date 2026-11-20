# Keitaro Wrapper

Обёртка над рекламным трекером [Keitaro](https://admin-api.docs.keitaro.io/):
CRUD кампаний типовой структуры и визуальный редактор потоков с распределением трафика между офферами.

Подробная спецификация — [docs/SPEC.md](docs/SPEC.md).

## Возможности

- **Кампании**: таблица с поиском по названию, создание / редактирование / удаление.
  При создании в Keitaro автоматически создаются кампания и два потока:
  - **Flow 1** — посетители из выбранной страны редиректятся на `https://google.com`;
  - **Flow 2** — остальной трафик распределяется на офферы (изначально — выбранный оффер, 100%).
- **Потоки кампании** (`Campaigns / {name} / Keitaro Streams`):
  - Fetch streams from KT / View in KT;
  - добавление, удаление и возврат офферов (Add / Remove / Bring back);
  - автоматический пересчёт долей, закрепление доли (Pin), ручной ввод доли;
  - черновик изменений с подсветкой и кнопками Push to KT / Cancel;
  - удалённые офферы (в т.ч. удалённые напрямую в Keitaro) не пропадают, а становятся серыми;
  - статистика и тренды кликов за 7 дней.

## Стек

| | |
|---|---|
| Backend | Python 3.12, FastAPI, SQLAlchemy 2 (async), Alembic, PostgreSQL, httpx |
| Frontend | TypeScript, React, Vite, Tailwind CSS, shadcn/ui, TanStack Query |
| Качество | ruff, mypy, pytest · ESLint, Prettier, Vitest · commitlint, GitHub Actions |

## Быстрый старт (Docker)

Требуется Docker с Compose.

```bash
cp .env.example .env
# укажите KEITARO_API_KEY (и при необходимости остальные KEITARO_* переменные)
docker compose up --build
```

Приложение: <http://localhost:8080> · API docs (Swagger): <http://localhost:8000/docs>

Миграции БД применяются автоматически при старте backend-контейнера.

## Локальная разработка

Требуется: [uv](https://docs.astral.sh/uv/) (сам поставит Python 3.12), Node.js 20+, Docker (для Postgres).

```bash
cp .env.example .env              # заполните KEITARO_API_KEY
npm install                       # git-хуки (commitlint)
docker compose up -d db           # PostgreSQL на localhost:5432

# backend → http://localhost:8000
cd backend
uv sync
uv run alembic upgrade head
uv run uvicorn app.main:app --reload

# frontend → http://localhost:5173 (проксирует /api на :8000)
cd frontend
npm install
npm run dev
```

## Переменные окружения

| Переменная | По умолчанию | Описание |
|---|---|---|
| `KEITARO_URL` | `https://tlgk.host/admin` | URL админки Keitaro (API: `{url}_api/v1`) |
| `KEITARO_API_KEY` | — | API-ключ Keitaro (**обязательно**) |
| `KEITARO_DOMAIN_ID` | `1813` | Домен, назначаемый кампаниям |
| `KEITARO_GROUP_ID` | `10332` | Группа кампаний |
| `KEITARO_TRAFFIC_SOURCE_ID` | `836` | Источник трафика |
| `DATABASE_URL` | `postgresql+asyncpg://keitaro:keitaro@localhost:5432/keitaro` | Подключение к БД |

## Проверки и тесты

```bash
# backend
cd backend
uv run ruff check . && uv run ruff format --check .
uv run mypy app tests
uv run pytest

# frontend
cd frontend
npm run lint          # ESLint + Prettier
npm run typecheck
npm test
```

Тесты не ходят в реальный Keitaro (HTTP замокан через respx) и не требуют Postgres (SQLite in-memory).
Те же проверки запускаются в CI (`.github/workflows/ci.yml`).

## Структура

```
backend/
  app/
    api/            # FastAPI-роутеры
    keitaro/        # HTTP-клиент Keitaro Admin API
    services/       # бизнес-логика: кампании, потоки (слияние, push), статистика
    models.py       # SQLAlchemy-модели
    schemas.py      # Pydantic-схемы
  alembic/          # миграции
  tests/
frontend/
  src/
    components/ui/  # shadcn/ui
    features/       # campaigns (список, форма), streams (детальная страница)
    lib/            # api-клиент, расчёт долей и черновика (с тестами)
docs/SPEC.md
```

## Коммиты

Используется [Conventional Commits](https://www.conventionalcommits.org/), проверка — commitlint
(хук `commit-msg` через husky, ставится `npm install` в корне).
Допустимые scope: `backend`, `frontend`, `docs`, `ci`, `infra`, `deps`.

```
feat(frontend): add pin button to share column
fix(backend): keep removed offers on sync
```
