from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.constants import NodeType
from app.db import get_uow
from app.exceptions import GraphboardError
from app.nodes import service as node_service
from app.nodes.schemas import NodeCreate, NodeRead

router = APIRouter(prefix="/nodes", tags=["nodes"])


@router.get("/graph/{graph_id}", response_model=list[NodeRead])
async def get_nodes(graph_id: uuid.UUID, uow: Any = Depends(get_uow)) -> list[NodeRead]:
    nodes = await node_service.list_nodes(uow, graph_id)
    return [NodeRead.model_validate(n) for n in nodes]


@router.post("/", response_model=uuid.UUID, status_code=status.HTTP_201_CREATED)
async def create_node(payload: NodeCreate, uow: Any = Depends(get_uow)) -> uuid.UUID:
    node_id = await node_service.create_node(uow, payload)
    await uow.commit()
    return node_id


@router.delete("/{node_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_node(node_id: uuid.UUID, uow: Any = Depends(get_uow)) -> None:
    await node_service.delete_node(uow, node_id)
    await uow.commit()


@router.post("/from-expression/{expression_id}", response_model=uuid.UUID, status_code=201)
async def create_connected_node(
    expression_id: uuid.UUID, node_type: NodeType, uow: Any = Depends(get_uow)
) -> uuid.UUID:
    try:
        new_node_id = await node_service.create_connected_node(uow, expression_id, node_type)
        await uow.commit()
        return new_node_id
    except GraphboardError:
        await uow.rollback()
        raise
    except Exception as e:
        await uow.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{node_id}/shortcircuit", status_code=status.HTTP_204_NO_CONTENT)
async def shortcircuit_node(node_id: uuid.UUID, uow: Any = Depends(get_uow)) -> None:
    try:
        await node_service.shortcircuit_node(uow, node_id)
        await uow.commit()
    except GraphboardError:
        await uow.rollback()
        raise
    except Exception as e:
        await uow.rollback()
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/insert-between/{expression_id}", response_model=uuid.UUID, status_code=201)
async def insert_node_between(expression_id: uuid.UUID, node_type: NodeType, uow: Any = Depends(get_uow)) -> uuid.UUID:
    try:
        new_node_id = await node_service.insert_node_between(uow, expression_id, node_type)
        await uow.commit()
        return new_node_id
    except GraphboardError:
        await uow.rollback()
        raise
    except Exception as e:
        await uow.rollback()
        raise HTTPException(status_code=500, detail=str(e))
