# Consilium

**Your private council of minds.**

A multi-persona advisory web app that lets you assemble a council of 3–5 advisors and ask for guidance on decisions, strategy, writing, problem-solving, and reflection. Each advisor responds from a distinct worldview, and a synthesis highlights agreement, disagreement, and actionable next steps.

## Project Structure

```
├── docs/           # Planning and specification documents
├── backend/        # FastAPI service (API, workers, LangGraph graphs)
├── frontend/       # Next.js web app (TODO: scaffold)
├── tests/          # Evaluation test fixtures
└── docker-compose.yml
```

## Quick Start

```bash
# Start Postgres with pgvector
docker compose up db

# Run the API server
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Documentation

See [docs/README.md](docs/README.md) for the full planning document suite.
