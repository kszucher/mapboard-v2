import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app import edges, expressions, graphs, nodes, users, ws
from app.config import settings
from app.exceptions import GraphboardError

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

    @app.exception_handler(GraphboardError)
    async def graphboard_exception_handler(request: Request, exc: GraphboardError):
        return JSONResponse(
            status_code=exc.status_code,
            content={"detail": exc.message},
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
    app.include_router(expressions.router)

    @app.get("/health")
    async def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.on_event("startup")
    async def _startup() -> None:
        from app.context import UnitOfWork
        from app.db import SessionLocal
        from app.events import get_broker
        from app.nodes.service import cleanup_duplicate_iids_for_graph

        async with SessionLocal() as session:
            broker = get_broker()
            uow = UnitOfWork(session, broker)
            try:
                graphs = await uow.graphs.list_all()
                for graph in graphs:
                    await cleanup_duplicate_iids_for_graph(uow, graph.id)
                await uow.commit()
                logger.info("Startup duplicate node IID cleanup completed successfully.")
            except Exception as e:
                logger.exception("Failed to run duplicate IID cleanup during startup: %s", e)
                await uow.rollback()

    return app


app = create_app()
