from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.graphs.repository import GraphRepository
from app.graphs.schemas import GraphCreate, GraphRead
from app.graphs import service as graph_service
from app.events import broker

router = APIRouter(prefix="/graphs", tags=["graphs"])


@router.post("/", response_model=uuid.UUID, status_code=status.HTTP_201_CREATED)
async def create_graph(
    payload: GraphCreate,
    session: AsyncSession = Depends(get_session),
    x_client_id: str | None = Header(default=None),
) -> uuid.UUID:
    return await graph_service.create_graph(session, payload.user_id, payload.graph_name, broker, x_client_id)


@router.get("/user/{user_id}", response_model=list[GraphRead])
async def list_graphs(user_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> list[GraphRead]:
    repo = GraphRepository(session)
    graphs = await repo.list_by_user(user_id)
    return [GraphRead.model_validate(g) for g in graphs]
