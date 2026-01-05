from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter, Depends, status
from app.db import get_uow
from app.edges.schemas import EdgeCreate, EdgeRead
from app.edges import service as edge_service

router = APIRouter(prefix="/edges", tags=["edges"])


@router.get("/graph/{graph_id}", response_model=list[EdgeRead])
async def get_edges(graph_id: uuid.UUID, uow: Any = Depends(get_uow)) -> list[EdgeRead]:
    edges = await edge_service.list_edges(uow, graph_id)
    return [EdgeRead.model_validate(e) for e in edges]


@router.post("/", response_model=uuid.UUID, status_code=status.HTTP_201_CREATED)
async def create_edge(
    payload: EdgeCreate,
    uow: Any = Depends(get_uow)
) -> uuid.UUID:
    edge_id = await edge_service.create_edge(uow, payload)
    await uow.commit()
    return edge_id


@router.delete("/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_edge(
    edge_id: uuid.UUID,
    uow: Any = Depends(get_uow)
) -> None:
    await edge_service.delete_edge(uow, edge_id)
    await uow.commit()
