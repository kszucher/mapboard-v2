from __future__ import annotations

import uuid
from typing import Any
from fastapi import APIRouter, Depends, status
from app.db import get_uow
from app.nodes import schemas
from app.nodes import service as node_service
from app.nodes.schemas import NodeCreate, NodeRead

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.get("/graph/{graph_id}", response_model=list[NodeRead])
async def get_nodes(graph_id: uuid.UUID, uow: Any = Depends(get_uow)) -> list[NodeRead]:
    nodes = await node_service.list_nodes(uow, graph_id)
    return [NodeRead.model_validate(n) for n in nodes]


@router.post("/", response_model=uuid.UUID, status_code=status.HTTP_201_CREATED)
async def create_node(
    payload: NodeCreate,
    uow: Any = Depends(get_uow)
) -> uuid.UUID:
    node_id = await node_service.create_node(uow, payload)
    await uow.commit()
    return node_id


@router.patch("/{node_id}/offset", status_code=status.HTTP_204_NO_CONTENT)
async def update_node_offset(
    node_id: uuid.UUID,
    payload: schemas.UpdateNodeOffset,
    uow: Any = Depends(get_uow)
) -> None:
    await node_service.update_node_offset(uow, node_id, payload.offset_x, payload.offset_y)
    await uow.commit()


@router.patch("/{node_id}/dimensions", status_code=status.HTTP_204_NO_CONTENT)
async def update_node_dimensions(
    node_id: uuid.UUID,
    payload: schemas.UpdateNodeDimensions,
    uow: Any = Depends(get_uow)
) -> None:
    await node_service.update_node_dimensions(uow, node_id, payload.width, payload.height)
    await uow.commit()


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(
    node_id: uuid.UUID,
    uow: Any = Depends(get_uow)
) -> None:
    await node_service.delete_node(uow, node_id)
    await uow.commit()
