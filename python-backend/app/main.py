from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import edges, graphs, nodes, users, ws
from app.config import settings
import logging

logger = logging.getLogger(__name__)


def create_app() -> FastAPI:
    app = FastAPI(title="Graphboard API", version="0.1.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )

    @app.exception_handler(Exception)
    async def global_exception_handler(request: Request, exc: Exception):
        logger.exception("Unhandled exception: %s", exc)
        return JSONResponse(
            status_code=500,
            content={"detail": "Internal Server Error", "error": str(exc)},
        )

    app.include_router(users.router)
    app.include_router(graphs.router)
    app.include_router(nodes.router)
    app.include_router(edges.router)
    app.include_router(ws.router)
    from app import expressions
    app.include_router(expressions.router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.on_event("startup")
    async def _startup() -> None:
        return

    return app


app = create_app()
