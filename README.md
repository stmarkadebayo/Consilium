# Consilium

**Your private council of minds.**

A multi-persona advisory web app that lets you assemble a council of 2–5 advisors and ask for guidance on decisions, strategy, writing, problem-solving, and reflection. Each advisor responds from a distinct worldview, and a synthesis highlights agreement, disagreement, and actionable next steps.

## Project Structure

```
├── docs/           # Planning and specification documents
├── backend/        # FastAPI API + worker + retrieval + jobs
├── frontend/       # Next.js web app
├── tests/          # Evaluation test fixtures
└── docker-compose.yml
```

## Quick Start

```bash
# Local-first mode: no auth gate, split landing page at /
# Backend setup
cd backend
cp .env.example .env
pip install -r requirements.txt
python3 -m alembic upgrade head
uvicorn app.main:app --reload

# Frontend setup
cd ../frontend
cp .env.example .env.local
npm install
npm run dev
```

Open `http://127.0.0.1:3000/`.

## Full Stack With Docker

```bash
# Backend setup
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
docker compose up --build
```

## Worker Process

- The API no longer executes background jobs inline.
- Run a separate worker process for persona research and council queries:

```bash
cd backend
python -m app.worker
```

- In production, set `JOB_RUNNER_ENABLED=false` on the API process and run the worker separately.

## Supabase Setup

- Create a Supabase project for Auth + Postgres
- Put the Supabase Postgres connection string in `backend/.env` as `DATABASE_URL`
- Set `AUTH_PROVIDER=supabase`, `SUPABASE_URL`, and `SUPABASE_PUBLISHABLE_KEY` in `backend/.env`
- Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and `NEXT_PUBLIC_API_BASE_URL` in `frontend/.env.local`
- Run the backend migrations, then sign in through `/`
- Mock frontend mode is now opt-in via `NEXT_PUBLIC_USE_MOCK_API=true`

## Containers

- Local stack with bundled Postgres:

```bash
docker compose up --build
```

- Production-style container split:
  - `api` serves HTTP
  - `worker` executes queued jobs
  - `web` serves the Next.js app
  - use Supabase Postgres by setting `DATABASE_URL` in `backend/.env`
  - set `NEXT_PUBLIC_API_BASE_URL` in your shell before building so the web image bakes the correct public API origin

```bash
export NEXT_PUBLIC_API_BASE_URL=https://api.example.com
docker compose -f docker-compose.prod.yml up --build
```

## Verification

```bash
cd backend && python3 -m pytest tests -q
cd frontend && npm run lint
cd frontend && npm run build
cd frontend && npm run test:e2e
```

## Documentation

See [docs/README.md](docs/README.md) for the full planning document suite.
