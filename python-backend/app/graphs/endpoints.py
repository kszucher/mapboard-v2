from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter, Depends, status
from app.db import get_uow
from app.graphs.schemas import GraphCreate, GraphRead
from app.graphs import service as graph_service

router = APIRouter(prefix="/graphs", tags=["graphs"])


@router.post("/", response_model=uuid.UUID, status_code=status.HTTP_201_CREATED)
async def create_graph(
    payload: GraphCreate,
    uow: Any = Depends(get_uow)
) -> uuid.UUID:
    graph_id = await graph_service.create_graph(uow, payload.user_id, payload.graph_name)
    await uow.commit()
    return graph_id


@router.get("/user/{user_id}", response_model=list[GraphRead])
async def list_graphs(user_id: uuid.UUID, uow: Any = Depends(get_uow)) -> list[GraphRead]:
    graphs = await graph_service.list_graphs_by_user(uow, user_id)
    return [GraphRead.model_validate(g) for g in graphs]
