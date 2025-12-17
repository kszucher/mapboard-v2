from __future__ import annotations

from app import models
from app.api import edges, graphs, nodes, users, ws
from app.config import settings
from app.db import engine
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


async def init_models() -> None:
    async with engine.begin() as conn:
        await conn.run_sync(models.Base.metadata.create_all)


def create_app() -> FastAPI:
    app = FastAPI(title="Graphboard API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(users.router)
    app.include_router(graphs.router)
    app.include_router(nodes.router)
    app.include_router(edges.router)
    app.include_router(ws.router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.on_event("startup")
    async def _startup() -> None:
        await init_models()

    return app


app = create_app()


