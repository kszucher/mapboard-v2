from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.repositories.edges import EdgeRepository
from app.schemas import DeleteEdgesByHandle, EdgeCreate, EdgeRead
from app.services import edges as edge_service
from app.services.events import broker

router = APIRouter(prefix="/edges", tags=["edges"])


@router.get("/graph/{graph_id}", response_model=list[EdgeRead])
async def get_edges(graph_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> list[EdgeRead]:
    repo = EdgeRepository(session)
    edges = await repo.list_by_graph(graph_id)
    return [EdgeRead.model_validate(e) for e in edges]


@router.post("/", response_model=uuid.UUID, status_code=status.HTTP_201_CREATED)
async def create_edge(payload: EdgeCreate, session: AsyncSession = Depends(get_session)) -> uuid.UUID:
    return await edge_service.create_edge(session, payload.model_dump(), broker)


@router.delete("/{edge_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_edge(edge_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> None:
    await edge_service.delete_edge(session, edge_id, broker)


@router.post("/delete-by-handle", status_code=status.HTTP_204_NO_CONTENT)
async def delete_by_handle(payload: DeleteEdgesByHandle, session: AsyncSession = Depends(get_session)) -> None:
    await edge_service.delete_edges_by_handle(session, payload.from_node_id, payload.deleted_handle_index, broker)
