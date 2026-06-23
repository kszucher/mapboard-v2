from __future__ import annotations

import uuid
import logging
from typing import TYPE_CHECKING

from app import models
from app.expressions import service as expression_service
from app.nodes.schemas import NodeCreate, NodeOffsetUpdate
from app.edges.schemas import EdgeCreate
from app.constants import EventName, NodeType
from app.exceptions import ValidationError, NotFoundError
from app.schemas import Color

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

async def create_connected_node(
    uow: UnitOfWork,
    expression_id: uuid.UUID,
    node_type: NodeType,
) -> uuid.UUID:
    if node_type == NodeType.START:
        raise ValidationError("Cannot connect a new START node.")

    expr = await uow.expressions.get(expression_id)
    if not expr:
        raise NotFoundError(f"Expression {expression_id} not found")

    existing_edges = await uow.edges.list_by_expression(expression_id)
    if existing_edges:
        raise ValidationError("Expression is already connected to another node.")

    parent_node = await uow.nodes.get(expr.node_id)
    if not parent_node:
        raise NotFoundError("Parent node not found")

    # Calculate next iid
    all_nodes = await uow.nodes.list_by_graph(parent_node.graph_id)
    next_iid = max([n.iid for n in all_nodes], default=0) + 1

    NODE_COLORS: dict[NodeType, Color] = {
        NodeType.LOGIC: "purple",
        NodeType.AGENT: "blue",
        NodeType.LOGICAL_SWITCH: "amber",
        NodeType.AGENTIC_SWITCH: "grass",
    }
    NODE_LABELS = {
        NodeType.LOGIC: "Logic",
        NodeType.AGENT: "Agent",
        NodeType.LOGICAL_SWITCH: "Logical Switch",
        NodeType.AGENTIC_SWITCH: "Agentic Switch",
    }

    # 1. Create the new node using repository directly
    new_node = await uow.nodes.create(
        NodeCreate(
            graph_id=parent_node.graph_id,
            iid=next_iid,
            width=200,
            height=120,
            offset_x=parent_node.offset_x + parent_node.width + 100,
            offset_y=parent_node.offset_y,
            color=NODE_COLORS[node_type],
            label=NODE_LABELS[node_type],
            is_processing=False,
            node_type=node_type,
        )
    )

    # 2. Initialize default expressions for the new node
    await expression_service.create_default_expressions_for_node(uow, new_node)

    # 3. Emit Node Created event
    uow.emit(
        event=EventName.NODE_CREATED,
        graph_id=new_node.graph_id,
        payload={"nodeId": new_node.id},
    )

    # 4. Create the connecting edge using repository directly
    new_edge = await uow.edges.create(
        EdgeCreate(
            graph_id=parent_node.graph_id,
            from_node_id=parent_node.id,
            to_node_id=new_node.id,
            from_expression_id=expr.id,
            handle_index=0,
        )
    )

    # 5. Emit Edge Created event
    uow.emit(
        event=EventName.EDGE_CREATED,
        graph_id=new_edge.graph_id,
        payload={"edgeId": new_edge.id},
    )

    return new_node.id
