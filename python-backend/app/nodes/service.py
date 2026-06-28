from __future__ import annotations

import logging
import uuid
from typing import TYPE_CHECKING

from app import models
from app.constants import EventName, NodeType
from app.edges.schemas import EdgeCreate
from app.exceptions import NotFoundError, ValidationError
from app.expressions import service as expression_service
from app.nodes.schemas import NodeCreate
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
        event=EventName.GRAPH_UPDATED,
        graph_id=node.graph_id,
        payload={},
    )
    return node.id


async def delete_node(uow: UnitOfWork, node_id: uuid.UUID) -> None:
    node = await uow.nodes.get(node_id)
    if not node:
        return

    await uow.edges.delete_by_node(node_id)
    await uow.nodes.delete(node_id)

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=node.graph_id,
        payload={},
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
        NodeType.JOIN: "indigo",
    }
    NODE_LABELS = {
        NodeType.LOGIC: "Logic",
        NodeType.AGENT: "Agent",
        NodeType.LOGICAL_SWITCH: "Logical Switch",
        NodeType.AGENTIC_SWITCH: "Agentic Switch",
        NodeType.JOIN: "Join",
    }

    # 1. Create the new node using repository directly
    new_node = await uow.nodes.create(
        NodeCreate(
            graph_id=parent_node.graph_id,
            iid=next_iid,
            color=NODE_COLORS[node_type],
            label=NODE_LABELS[node_type],
            is_processing=False,
            node_type=node_type,
        )
    )

    # 2. Initialize default expressions for the new node
    await expression_service.create_default_expressions_for_node(uow, new_node)

    to_expression_id = None
    if node_type == NodeType.JOIN:
        new_node_expressions = await uow.expressions.list_by_node(new_node.id)
        sub_exprs = [e for e in new_node_expressions if e.type == "SUB"]
        if sub_exprs:
            sub_exprs.sort(key=lambda x: x.idx)
            to_expression_id = sub_exprs[0].id

    # 4. Create the connecting edge using repository directly
    await uow.edges.create(
        EdgeCreate(
            graph_id=parent_node.graph_id,
            from_node_id=parent_node.id,
            to_node_id=new_node.id,
            from_expression_id=expr.id,
            to_expression_id=to_expression_id,
            handle_index=0,
        )
    )

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=parent_node.graph_id,
        payload={},
    )

    return new_node.id


async def shortcircuit_node(uow: UnitOfWork, node_id: uuid.UUID) -> None:
    node = await uow.nodes.get(node_id)
    if not node:
        return

    if node.node_type in (NodeType.START, NodeType.LOGICAL_SWITCH, NodeType.AGENTIC_SWITCH, NodeType.JOIN):
        raise ValidationError("Cannot shortcircuit START, SWITCH, or JOIN nodes.")

    # 1. Get all edges connected to the node
    all_edges = await uow.edges.list_by_node(node_id)
    incoming = [e for e in all_edges if e.to_node_id == node_id]
    outgoing = [e for e in all_edges if e.from_node_id == node_id]

    deleted_edge_ids = []

    if outgoing and incoming:
        # Sort outgoing edges by handle_index
        outgoing.sort(key=lambda e: e.handle_index)
        primary_target_node_id = outgoing[0].to_node_id
        primary_target_expression_id = outgoing[0].to_expression_id

        # Retarget all incoming edges' to_node_id and to_expression_id to the primary target
        for in_edge in incoming:
            in_edge.to_node_id = primary_target_node_id
            in_edge.to_expression_id = primary_target_expression_id

        # All outgoing edges will be deleted because their source node is deleted (cascade delete).
        # We collect their IDs to emit EDGE_DELETED events.
        for out_edge in outgoing:
            deleted_edge_ids.append(out_edge.id)
    else:
        # If there are no outgoing targets or no incoming edges,
        # all connected edges will just be deleted.
        for edge in all_edges:
            deleted_edge_ids.append(edge.id)

    # 2. Delete the node
    await uow.nodes.delete(node_id)
    await uow.session.flush()

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=node.graph_id,
        payload={},
    )


async def insert_node_between(
    uow: UnitOfWork,
    expression_id: uuid.UUID,
    node_type: NodeType,
) -> uuid.UUID:
    if node_type not in (NodeType.LOGIC, NodeType.AGENT):
        raise ValidationError("Can only insert LOGIC or AGENT nodes.")

    expr = await uow.expressions.get(expression_id)
    if not expr:
        raise NotFoundError(f"Expression {expression_id} not found")

    existing_edges = await uow.edges.list_by_expression(expression_id)
    if not existing_edges:
        raise ValidationError("Expression is not connected to any node.")

    existing_edge = existing_edges[0]
    old_to_node_id = existing_edge.to_node_id

    parent_node = await uow.nodes.get(expr.node_id)
    if not parent_node:
        raise NotFoundError("Parent node not found")

    # Calculate next iid
    all_nodes = await uow.nodes.list_by_graph(parent_node.graph_id)
    next_iid = max([n.iid for n in all_nodes], default=0) + 1

    NODE_COLORS: dict[NodeType, Color] = {
        NodeType.LOGIC: "purple",
        NodeType.AGENT: "blue",
    }
    NODE_LABELS = {
        NodeType.LOGIC: "Logic",
        NodeType.AGENT: "Agent",
    }

    # 1. Create the new node using repository directly
    new_node = await uow.nodes.create(
        NodeCreate(
            graph_id=parent_node.graph_id,
            iid=next_iid,
            color=NODE_COLORS[node_type],
            label=NODE_LABELS[node_type],
            is_processing=False,
            node_type=node_type,
        )
    )

    # 2. Initialize default expressions for the new node
    await expression_service.create_default_expressions_for_node(uow, new_node)

    # 3. Retrieve the created BASE expression of the new node
    new_expressions = await uow.expressions.list_by_node(new_node.id)
    new_base_expr = next((e for e in new_expressions if e.type == "BASE"), None)
    if not new_base_expr:
        raise ValidationError("Base expression not created for the new node.")

    # 4. Reassign original edge to point to the newly created node
    old_to_expression_id = existing_edge.to_expression_id
    existing_edge.to_node_id = new_node.id
    existing_edge.to_expression_id = None
    await uow.session.flush()

    # 7. Create the new connecting edge from new node to the old target node
    await uow.edges.create(
        EdgeCreate(
            graph_id=parent_node.graph_id,
            from_node_id=new_node.id,
            to_node_id=old_to_node_id,
            from_expression_id=new_base_expr.id,
            to_expression_id=old_to_expression_id,
            handle_index=0,
        )
    )

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=new_node.graph_id,
        payload={},
    )

    return new_node.id
