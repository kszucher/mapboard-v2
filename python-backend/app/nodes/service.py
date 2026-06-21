from __future__ import annotations

import uuid
import logging
from typing import TYPE_CHECKING

from app import models
from app.expressions import service as expression_service
from app.nodes.schemas import NodeCreate, NodeOffsetUpdate
from app.constants import EventName

if TYPE_CHECKING:
    from app.context import UnitOfWork

logger = logging.getLogger(__name__)


async def list_nodes(uow: UnitOfWork, graph_id: uuid.UUID) -> list[models.Node]:
    return await uow.nodes.list_by_graph(graph_id)


async def create_node(uow: UnitOfWork, data: NodeCreate) -> uuid.UUID:
    # Repository now handles the simplified node creation
    node = await uow.nodes.create(data)
    
    # Isolate expression creation to its own service logic
    await expression_service.create_default_expressions_for_node(uow, node)

    uow.emit(
        event=EventName.NODE_CREATED,
        graph_id=node.graph_id,
        payload={"nodeId": node.id},
    )
    return node.id


async def update_node_offset(
    uow: UnitOfWork,
    node_id: uuid.UUID,
    offset_x: int,
    offset_y: int,
) -> None:
    node = await uow.nodes.get(node_id)
    if node is None:
        return
    
    node.offset_x = offset_x
    node.offset_y = offset_y
    
    uow.emit(
        event=EventName.NODE_UPDATED,
        graph_id=node.graph_id,
        payload={"nodeId": node_id, "patch": {"offset_x": offset_x, "offset_y": offset_y}},
    )


async def update_nodes_offsets(
    uow: UnitOfWork,
    offsets: list[NodeOffsetUpdate],
) -> None:
    for update in offsets:
        node = await uow.nodes.get(update.id)
        if node is not None:
            node.offset_x = update.offset_x
            node.offset_y = update.offset_y
            uow.emit(
                event=EventName.NODE_UPDATED,
                graph_id=node.graph_id,
                payload={"nodeId": update.id, "patch": {"offset_x": update.offset_x, "offset_y": update.offset_y}},
            )


async def update_node_dimensions(
    uow: UnitOfWork,
    node_id: uuid.UUID,
    width: int,
    height: int,
) -> None:
    node = await uow.nodes.get(node_id)
    if node is None:
        return
    
    node.width = width
    node.height = height
    
    uow.emit(
        event=EventName.NODE_UPDATED,
        graph_id=node.graph_id,
        payload={"nodeId": node_id, "patch": {"width": width, "height": height}},
    )


async def delete_node(uow: UnitOfWork, node_id: uuid.UUID) -> None:
    node = await uow.nodes.get(node_id)
    if not node:
        return

    edges = await uow.edges.list_by_node(node_id)
    await uow.edges.delete_by_node(node_id)
    await uow.nodes.delete(node_id)

    uow.emit(
        event=EventName.NODE_DELETED,
        graph_id=node.graph_id,
        payload={"nodeId": node_id},
    )

    # Broadcast edge deletions
    for edge in edges:
        uow.emit(
            event=EventName.EDGE_DELETED,
            graph_id=node.graph_id,
            payload={"edgeId": edge.id},
        )
