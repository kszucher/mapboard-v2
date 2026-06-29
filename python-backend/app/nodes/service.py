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
    # Calculate next iid to avoid duplicates
    all_nodes = await uow.nodes.list_by_graph(data.graph_id)
    next_iid = max([n.iid for n in all_nodes], default=0) + 1
    data.iid = next_iid

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
    node_id: uuid.UUID | None = None,
    base_expression_id: uuid.UUID | None = None,
    sub_expression_id: uuid.UUID | None = None,
    edge_id: uuid.UUID | None = None,
) -> uuid.UUID:
    if node_type == NodeType.START:
        raise ValidationError("Cannot connect a new START node.")

    expr = await uow.expressions.get(expression_id)
    if not expr:
        raise NotFoundError(f"Expression {expression_id} not found")

    existing_edges = await uow.edges.list_by_expression(expression_id)
    existing_outgoing = [e for e in existing_edges if e.from_expression_id == expression_id]
    if existing_outgoing:
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
        NodeType.END: "gray",
    }
    NODE_LABELS = {
        NodeType.LOGIC: "Logic",
        NodeType.AGENT: "Agent",
        NodeType.LOGICAL_SWITCH: "Logical Switch",
        NodeType.AGENTIC_SWITCH: "Agentic Switch",
        NodeType.JOIN: "Join",
        NodeType.END: "End",
    }

    # 1. Create the new node using repository directly
    new_node = await uow.nodes.create(
        NodeCreate(
            id=node_id,
            graph_id=parent_node.graph_id,
            iid=next_iid,
            color=NODE_COLORS[node_type],
            label=NODE_LABELS[node_type],
            is_processing=False,
            node_type=node_type,
        )
    )

    # 2. Initialize default expressions for the new node
    await expression_service.create_default_expressions_for_node(uow, new_node, base_expression_id, sub_expression_id)

    new_node_expressions = await uow.expressions.list_by_node(new_node.id)
    to_expression_id = None
    if node_type == NodeType.JOIN:
        sub_exprs = [e for e in new_node_expressions if e.type == "SUB"]
        if sub_exprs:
            sub_exprs.sort(key=lambda x: x.idx)
            to_expression_id = sub_exprs[0].id
    else:
        base_exprs = [e for e in new_node_expressions if e.type == "BASE"]
        if base_exprs:
            to_expression_id = base_exprs[0].id

    if not to_expression_id:
        raise ValidationError("Could not find a valid expression on the new node to connect to.")

    # 4. Create the connecting edge using repository directly
    await uow.edges.create(
        EdgeCreate(
            id=edge_id,
            graph_id=parent_node.graph_id,
            from_expression_id=expr.id,
            to_expression_id=to_expression_id,
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

    if node.node_type in (
        NodeType.START,
        NodeType.END,
    ):
        raise ValidationError("Cannot shortcircuit START or END nodes.")

    expressions = await uow.expressions.list_by_node(node_id)
    sub_exprs = [e for e in expressions if e.type == "SUB"]

    if node.node_type in (
        NodeType.LOGICAL_SWITCH,
        NodeType.AGENTIC_SWITCH,
        NodeType.JOIN,
    ):
        if len(sub_exprs) != 1:
            raise ValidationError(
                "Cannot shortcircuit SWITCH or JOIN nodes unless they have exactly one sub-expression."
            )

    # 1. Get all edges connected to the node
    all_edges = await uow.edges.list_by_node(node_id)
    incoming = [e for e in all_edges if e.to_node_id == node_id]
    outgoing = [e for e in all_edges if e.from_node_id == node_id]

    deleted_edge_ids = []

    if outgoing and incoming:
        # Sort outgoing edges deterministically
        outgoing.sort(key=lambda e: e.id)
        primary_target_expression_id = outgoing[0].to_expression_id

        # Retarget all incoming edges' to_expression_id to the primary target's expression
        for in_edge in incoming:
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
    if node_type not in (
        NodeType.LOGIC,
        NodeType.AGENT,
        NodeType.LOGICAL_SWITCH,
        NodeType.AGENTIC_SWITCH,
        NodeType.JOIN,
    ):
        raise ValidationError("Can only insert LOGIC, AGENT, SWITCH, or JOIN nodes.")

    expr = await uow.expressions.get(expression_id)
    if not expr:
        raise NotFoundError(f"Expression {expression_id} not found")

    existing_edges = await uow.edges.list_by_expression(expression_id)
    outgoing_edges = [e for e in existing_edges if e.from_expression_id == expression_id]
    if not outgoing_edges:
        raise ValidationError("Expression is not connected to any node.")

    existing_edge = outgoing_edges[0]

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

    # 3. Retrieve the created expressions of the new node
    new_expressions = await uow.expressions.list_by_node(new_node.id)
    new_base_expr = next((e for e in new_expressions if e.type == "BASE"), None)
    new_sub_expr = next((e for e in new_expressions if e.type == "SUB"), None)

    if not new_base_expr:
        raise ValidationError("Base expression not created for the new node.")
    if node_type in (NodeType.LOGICAL_SWITCH, NodeType.AGENTIC_SWITCH, NodeType.JOIN) and not new_sub_expr:
        raise ValidationError("Sub expression not created for the new node.")

    # Determine input (to) and output (from) expression IDs for routing
    if node_type == NodeType.JOIN:
        to_expression_id_for_new_node = new_sub_expr.id
        from_expression_id_for_new_node = new_base_expr.id
    elif node_type in (NodeType.LOGICAL_SWITCH, NodeType.AGENTIC_SWITCH):
        to_expression_id_for_new_node = new_base_expr.id
        from_expression_id_for_new_node = new_sub_expr.id
    else:
        to_expression_id_for_new_node = new_base_expr.id
        from_expression_id_for_new_node = new_base_expr.id

    # 4. Reassign original edge to point to the newly created node's input expression
    old_to_expression_id = existing_edge.to_expression_id
    existing_edge.to_expression_id = to_expression_id_for_new_node
    await uow.session.flush()

    # 7. Create the new connecting edge from new node's output expression to the old target node
    await uow.edges.create(
        EdgeCreate(
            graph_id=parent_node.graph_id,
            from_expression_id=from_expression_id_for_new_node,
            to_expression_id=old_to_expression_id,
        )
    )

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=new_node.graph_id,
        payload={},
    )

    return new_node.id


async def cleanup_duplicate_iids_for_graph(uow: UnitOfWork, graph_id: uuid.UUID) -> None:
    nodes = await uow.nodes.list_by_graph(graph_id)
    iids = [n.iid for n in nodes]
    if len(iids) != len(set(iids)):
        logger.info("Found duplicate iids in graph %s, cleaning up...", graph_id)
        sorted_nodes = sorted(
            nodes,
            key=lambda n: (0 if n.node_type == NodeType.START else 1, n.iid, n.id),
        )
        for idx, node in enumerate(sorted_nodes, start=1):
            if node.iid != idx:
                node.iid = idx
        await uow.session.flush()
