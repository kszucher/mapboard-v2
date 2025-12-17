# Graphboard Python backend

FastAPI + async SQLAlchemy + Postgres replacement for the Convex backend. Tooling uses uv for dependency management, ruff for linting, and mypy for type checking.

## Prereqs
- Python 3.11+
- Postgres reachable at `DATABASE_URL` (default: `postgresql+asyncpg://postgres:postgres@localhost:5432/graphboard`)
- [uv](https://github.com/astral-sh/uv) installed (`pip install uv` or `pipx install uv`)

## Setup
```bash
cd python-backend
uv sync
uv run ruff check
uv run mypy .
uv run fastapi dev app/main.py  # or: uv run uvicorn app.main:app --reload
```

## Dev notes
- API docs at `/docs` and `/openapi.json`.
- WebSocket channel: `/ws/graphs/{graph_id}` broadcasts change events for that graph.
- OpenAPI types: from repo root run  
  `cd frontend && npm run generate:api` (see `frontend/package.json` script) once the backend is running.


