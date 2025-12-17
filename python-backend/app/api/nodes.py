from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db import get_session
from app.repositories.nodes import NodeRepository
from app.schemas import NodeCreate, NodeRead
from app.services import nodes as node_service
from app.services.events import broker

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.get("/graph/{graph_id}", response_model=list[NodeRead])
async def get_nodes(graph_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> list[NodeRead]:
    repo = NodeRepository(session)
    nodes = await repo.list_by_graph(graph_id)
    return [NodeRead.model_validate(n) for n in nodes]


@router.post("/", response_model=uuid.UUID, status_code=status.HTTP_201_CREATED)
async def create_node(payload: NodeCreate, session: AsyncSession = Depends(get_session)) -> uuid.UUID:
    return await node_service.create_node(session, payload.model_dump(), broker)


@router.patch("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def update_node(node_id: uuid.UUID, patch: dict[str, Any], session: AsyncSession = Depends(get_session)) -> None:
    await node_service.update_node(session, node_id, patch, broker)


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(node_id: uuid.UUID, session: AsyncSession = Depends(get_session)) -> None:
    await node_service.delete_node(session, node_id, broker)

