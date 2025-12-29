from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, Header, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.nodes.repository import NodeRepository
from app.nodes import schemas
from app.nodes.schemas import NodeCreate, NodeRead
from app.nodes import service as node_service
from app.events import broker

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.get("/graph/{graph_id}", response_model=list[NodeRead])
async def get_nodes(graph_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> list[NodeRead]:
    repo = NodeRepository(session)
    nodes = await repo.list_by_graph(graph_id)
    return [NodeRead.model_validate(n) for n in nodes]


@router.post("/", response_model=uuid.UUID, status_code=status.HTTP_201_CREATED)
async def create_node(
    payload: NodeCreate,
    session: AsyncSession = Depends(get_session),
    x_client_id: str | None = Header(default=None),
) -> uuid.UUID:
    return await node_service.create_node(session, payload, broker, x_client_id)




@router.patch("/{node_id}/offset", status_code=status.HTTP_204_NO_CONTENT)
async def update_node_offset(
    node_id: uuid.UUID,
    payload: schemas.UpdateNodeOffset,
    session: AsyncSession = Depends(get_session),
    x_client_id: str | None = Header(default=None),
) -> None:
    await node_service.update_node_offset(
        session, node_id, payload.offset_x, payload.offset_y, broker, x_client_id
    )


@router.patch("/{node_id}/dimensions", status_code=status.HTTP_204_NO_CONTENT)
async def update_node_dimensions(
    node_id: uuid.UUID,
    payload: schemas.UpdateNodeDimensions,
    session: AsyncSession = Depends(get_session),
    x_client_id: str | None = Header(default=None),
) -> None:
    await node_service.update_node_dimensions(
        session, node_id, payload.width, payload.height, broker, x_client_id
    )





@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(
    node_id: uuid.UUID,
    session: AsyncSession = Depends(get_session),
    x_client_id: str | None = Header(default=None),
) -> None:
    await node_service.delete_node(session, node_id, broker, x_client_id)
