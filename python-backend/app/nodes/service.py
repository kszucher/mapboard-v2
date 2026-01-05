from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.edges.repository import EdgeRepository
from app.nodes.repository import NodeRepository
from app.expressions import service as expression_service
from app.schemas import GraphEvent
from app.events import GraphEventBroker
from app.nodes.schemas import NodeCreate
import logging

logger = logging.getLogger(__name__)


async def list_nodes(session: AsyncSession, graph_id: uuid.UUID) -> list[models.Node]:
    repo = NodeRepository(session)
    return await repo.list_by_graph(graph_id)


async def create_node(
    session: AsyncSession, data: NodeCreate, broker: GraphEventBroker, sender_client_id: str | None = None
) -> uuid.UUID:
    repo = NodeRepository(session)

    # Repository now handles the simplified node creation
    node = await repo.create(data)
    
    # Isolate expression creation to its own service logic
    await expression_service.create_default_expressions_for_node(session, node)

    await session.commit()
    await broker.broadcast(
        GraphEvent(
            event="node_created",
            graph_id=node.graph_id,
            payload={"nodeId": str(node.id)},
            sender_client_id=sender_client_id,
        )
    )
    return node.id


async def update_node_offset(
    session: AsyncSession,
    node_id: uuid.UUID,
    offset_x: int,
    offset_y: int,
    broker: GraphEventBroker,
    sender_client_id: str | None = None,
) -> None:
    repo = NodeRepository(session)
    node = await repo.get(node_id)
    
    if node is None:
        return
    
    node.offset_x = offset_x
    node.offset_y = offset_y
    
    await session.commit()
    
    await broker.broadcast(
        GraphEvent(
            event="node_updated",
            graph_id=node.graph_id,
            payload={"nodeId": str(node_id), "patch": {"offset_x": offset_x, "offset_y": offset_y}},
            sender_client_id=sender_client_id,
        )
    )


async def update_node_dimensions(
    session: AsyncSession,
    node_id: uuid.UUID,
    width: int,
    height: int,
    broker: GraphEventBroker,
    sender_client_id: str | None = None,
) -> None:
    repo = NodeRepository(session)
    node = await repo.get(node_id)
    
    if node is None:
        return
    
    node.width = width
    node.height = height
    
    await session.commit()
    
    await broker.broadcast(
        GraphEvent(
            event="node_updated",
            graph_id=node.graph_id,
            payload={"nodeId": str(node_id), "patch": {"width": width, "height": height}},
            sender_client_id=sender_client_id,
        )
    )




async def delete_node(
    session: AsyncSession, node_id: uuid.UUID, broker: GraphEventBroker, sender_client_id: str | None = None
) -> None:
    nodes_repo = NodeRepository(session)
    edges_repo = EdgeRepository(session)

    node = await nodes_repo.get(node_id)
    if not node:
        return

    await edges_repo.delete_by_node(node_id)

    await nodes_repo.delete(node_id)
    await session.commit()

    await broker.broadcast(
        GraphEvent(
            event="node_deleted",
            graph_id=node.graph_id,
            payload={"nodeId": str(node_id)},
            sender_client_id=sender_client_id,
        )
    )
