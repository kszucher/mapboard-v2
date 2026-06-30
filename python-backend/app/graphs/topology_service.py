from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app import models
from app.constants import EventName, ExpressionType, NodeType
from app.edges.schemas import EdgeCreate
from app.exceptions import NotFoundError, ValidationError
from app.expressions import service as expression_service
from app.expressions.schemas import ExpressionCreate
from app.nodes.schemas import NodeCreate

if TYPE_CHECKING:
    from app.context import UnitOfWork


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

    NODE_LABELS = {
        NodeType.LOGIC: "Logic",
        NodeType.AGENT: "Agent",
        NodeType.LOGICAL_SWITCH: "Logical Switch",
        NodeType.AGENTIC_SWITCH: "Agentic Switch",
        NodeType.LOGICAL_JOIN: "Logical Join",
        NodeType.AGENTIC_JOIN: "Agentic Join",
        NodeType.END: "End",
        NodeType.TRANSFORM_AGENT_TO_LOGICAL: "Transform Agent To Logical",
        NodeType.TRANSFORM_LOGICAL_TO_AGENT: "Transform Logical To Agent",
    }

    # 1. Create the new node using repository directly
    new_node = await uow.nodes.create(
        NodeCreate(
            id=node_id,
            graph_id=parent_node.graph_id,
            iid=next_iid,
            label=NODE_LABELS[node_type],
            is_processing=False,
            node_type=node_type,
        )
    )

    # 2. Initialize default expressions for the new node
    await expression_service.create_default_expressions_for_node(uow, new_node, base_expression_id, sub_expression_id)

    new_node_expressions = await uow.expressions.list_by_node(new_node.id)
    to_expression_id = None

    # Generic input port lookup:
    # 1. Prefer BASE_INPUT
    # 2. Else BASE_INPUT_OUTPUT
    # 3. Else SUB_INPUT (idx=0)
    base_input = next((e for e in new_node_expressions if e.type == "BASE_INPUT"), None)
    base_input_output = next((e for e in new_node_expressions if e.type == "BASE_INPUT_OUTPUT"), None)
    if base_input:
        to_expression_id = base_input.id
    elif base_input_output:
        to_expression_id = base_input_output.id
    else:
        sub_inputs = [e for e in new_node_expressions if e.type == "SUB_INPUT"]
        if sub_inputs:
            sub_inputs.sort(key=lambda x: x.idx)
            to_expression_id = sub_inputs[0].id

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
    sub_exprs = [e for e in expressions if e.type.startswith("SUB_")]

    if node.node_type in (
        NodeType.LOGICAL_SWITCH,
        NodeType.AGENTIC_SWITCH,
        NodeType.LOGICAL_JOIN,
        NodeType.AGENTIC_JOIN,
        NodeType.TRANSFORM_AGENT_TO_LOGICAL,
        NodeType.TRANSFORM_LOGICAL_TO_AGENT,
    ):
        if len(sub_exprs) != 1:
            raise ValidationError(
                "Cannot shortcircuit SWITCH, JOIN, or TRANSFORM nodes unless they have exactly one sub-expression."
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
        NodeType.LOGICAL_JOIN,
        NodeType.AGENTIC_JOIN,
        NodeType.TRANSFORM_AGENT_TO_LOGICAL,
        NodeType.TRANSFORM_LOGICAL_TO_AGENT,
    ):
        raise ValidationError("Can only insert LOGIC, AGENT, SWITCH, JOIN, or TRANSFORM nodes.")

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

    NODE_LABELS = {
        NodeType.LOGIC: "Logic",
        NodeType.AGENT: "Agent",
        NodeType.LOGICAL_SWITCH: "Logical Switch",
        NodeType.AGENTIC_SWITCH: "Agentic Switch",
        NodeType.LOGICAL_JOIN: "Logical Join",
        NodeType.AGENTIC_JOIN: "Agentic Join",
        NodeType.TRANSFORM_AGENT_TO_LOGICAL: "Transform Agent To Logical",
        NodeType.TRANSFORM_LOGICAL_TO_AGENT: "Transform Logical To Agent",
    }

    # 1. Create the new node using repository directly
    new_node = await uow.nodes.create(
        NodeCreate(
            graph_id=parent_node.graph_id,
            iid=next_iid,
            label=NODE_LABELS[node_type],
            is_processing=False,
            node_type=node_type,
        )
    )

    # 2. Initialize default expressions for the new node
    await expression_service.create_default_expressions_for_node(uow, new_node)

    # 3. Retrieve the created expressions of the new node
    new_expressions = await uow.expressions.list_by_node(new_node.id)

    # Generic input and output expression detection for the new node
    new_input_expr = next((e for e in new_expressions if e.type in ("BASE_INPUT", "BASE_INPUT_OUTPUT")), None)
    if not new_input_expr:
        sub_inputs = [e for e in new_expressions if e.type == "SUB_INPUT"]
        if sub_inputs:
            sub_inputs.sort(key=lambda x: x.idx)
            new_input_expr = sub_inputs[0]

    new_output_expr = next((e for e in new_expressions if e.type in ("BASE_OUTPUT", "BASE_INPUT_OUTPUT")), None)
    if not new_output_expr:
        sub_outputs = [e for e in new_expressions if e.type == "SUB_OUTPUT"]
        if sub_outputs:
            sub_outputs.sort(key=lambda x: x.idx)
            new_output_expr = sub_outputs[0]

    if not new_input_expr:
        raise ValidationError("Input expression not found for the new node.")
    if not new_output_expr:
        raise ValidationError("Output expression not found for the new node.")

    # 4. Reassign original edge to point to the newly created node's input expression
    old_to_expression_id = existing_edge.to_expression_id
    existing_edge.to_expression_id = new_input_expr.id
    await uow.session.flush()

    # 7. Create the new connecting edge from new node's output expression to the old target node
    await uow.edges.create(
        EdgeCreate(
            graph_id=parent_node.graph_id,
            from_expression_id=new_output_expr.id,
            to_expression_id=old_to_expression_id,
        )
    )

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=new_node.graph_id,
        payload={},
    )

    return new_node.id


async def convert_node(
    uow: UnitOfWork,
    node_id: uuid.UUID,
    target_type: NodeType,
) -> uuid.UUID:
    node = await uow.nodes.get(node_id)
    if not node:
        raise NotFoundError(f"Node {node_id} not found")

    if node.node_type == target_type:
        return node.id

    # Validate allowed conversions
    allowed = False
    if node.node_type == NodeType.AGENT and target_type == NodeType.LOGIC:
        allowed = True
    elif node.node_type == NodeType.LOGIC and target_type == NodeType.AGENT:
        allowed = True
    elif node.node_type == NodeType.AGENTIC_SWITCH and target_type == NodeType.TRANSFORM_AGENT_TO_LOGICAL:
        allowed = True
    elif node.node_type == NodeType.TRANSFORM_AGENT_TO_LOGICAL and target_type == NodeType.AGENTIC_SWITCH:
        allowed = True
    elif node.node_type == NodeType.LOGICAL_SWITCH and target_type == NodeType.TRANSFORM_LOGICAL_TO_AGENT:
        allowed = True
    elif node.node_type == NodeType.TRANSFORM_LOGICAL_TO_AGENT and target_type == NodeType.LOGICAL_SWITCH:
        allowed = True

    if not allowed:
        raise ValidationError(f"Conversion from {node.node_type} to {target_type} is not allowed.")

    NODE_LABELS = {
        NodeType.LOGIC: "Logic",
        NodeType.AGENT: "Agent",
        NodeType.LOGICAL_SWITCH: "Logical Switch",
        NodeType.AGENTIC_SWITCH: "Agentic Switch",
        NodeType.LOGICAL_JOIN: "Logical Join",
        NodeType.AGENTIC_JOIN: "Agentic Join",
        NodeType.END: "End",
        NodeType.TRANSFORM_AGENT_TO_LOGICAL: "Transform Agent To Logical",
        NodeType.TRANSFORM_LOGICAL_TO_AGENT: "Transform Logical To Agent",
    }

    # Perform specific conversion logic
    if (node.node_type in (NodeType.AGENT, NodeType.LOGIC)) and (target_type in (NodeType.AGENT, NodeType.LOGIC)):
        # Agent <-> Logic: Only node type changes (and label if default)
        if node.label == NODE_LABELS.get(NodeType(node.node_type)):
            node.label = NODE_LABELS[target_type]
        node.node_type = target_type
        await uow.session.flush()

    elif node.node_type in (NodeType.AGENTIC_SWITCH, NodeType.LOGICAL_SWITCH):
        # Switch -> Transform
        await _convert_switch_to_transform(uow, node, target_type, NODE_LABELS)

    elif node.node_type in (NodeType.TRANSFORM_AGENT_TO_LOGICAL, NodeType.TRANSFORM_LOGICAL_TO_AGENT):
        # Transform -> Switch
        await _convert_transform_to_switch(uow, node, target_type, NODE_LABELS)

    # Re-retrieve and validate all node expressions to make sure it matches target_type constraints
    updated_expressions = await uow.expressions.list_by_node(node.id)
    expression_service.validate_expressions_for_node_type(target_type, updated_expressions)

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=node.graph_id,
        payload={},
    )
    return node.id


async def _convert_switch_to_transform(
    uow: UnitOfWork,
    node: models.Node,
    target_type: NodeType,
    node_labels: dict[NodeType, str],
) -> None:
    expressions = await uow.expressions.list_by_node(node.id)

    # 1. Create a new BASE_OUTPUT expression
    new_base_output = await uow.expressions.create(
        ExpressionCreate(
            id=uuid.uuid4(),
            node_id=node.id,
            idx=0,
            type=ExpressionType.BASE_OUTPUT,
            raw_string="",
        )
    )

    # 2. Convert SUB_OUTPUT to SUB_UNCONNECTED and rewire outgoing edges
    sub_outputs = [e for e in expressions if e.type == ExpressionType.SUB_OUTPUT]
    for sub_output in sub_outputs:
        edges = await uow.edges.list_by_expression(sub_output.id)
        outgoing = [e for e in edges if e.from_expression_id == sub_output.id]
        for edge in outgoing:
            edge.from_expression_id = new_base_output.id

        sub_output.type = ExpressionType.SUB_UNCONNECTED

    # 3. Update node fields
    if node.label == node_labels.get(NodeType(node.node_type)):
        node.label = node_labels[target_type]
    node.node_type = target_type

    await uow.session.flush()


async def _convert_transform_to_switch(
    uow: UnitOfWork,
    node: models.Node,
    target_type: NodeType,
    node_labels: dict[NodeType, str],
) -> None:
    expressions = await uow.expressions.list_by_node(node.id)

    base_output = next((e for e in expressions if e.type == ExpressionType.BASE_OUTPUT), None)
    if not base_output:
        raise ValidationError("Target node must have a BASE_OUTPUT expression to convert to switch.")

    edges = await uow.edges.list_by_expression(base_output.id)
    outgoing = [e for e in edges if e.from_expression_id == base_output.id]

    if len(outgoing) > 1:
        raise ValidationError(
            f"Cannot convert to Switch node: the BASE_OUTPUT has {len(outgoing)} outgoing edges. "
            "At most one outgoing edge is allowed for conversion."
        )

    sub_unconnecteds = [e for e in expressions if e.type == ExpressionType.SUB_UNCONNECTED]
    sub_unconnecteds.sort(key=lambda e: e.idx)

    if len(sub_unconnecteds) == 0:
        raise ValidationError("Node has no sub-expressions to map.")

    # 1. Rewire if there is exactly 1 outgoing edge to the first sub-expression (idx=0)
    if len(outgoing) == 1:
        first_sub = sub_unconnecteds[0]
        outgoing[0].from_expression_id = first_sub.id

    # 2. Convert all SUB_UNCONNECTED to SUB_OUTPUT
    for sub in sub_unconnecteds:
        sub.type = ExpressionType.SUB_OUTPUT

    # 3. Delete BASE_OUTPUT expression
    await uow.expressions.delete(base_output.id)

    # 4. Update node fields
    if node.label == node_labels.get(NodeType(node.node_type)):
        node.label = node_labels[target_type]
    node.node_type = target_type

    await uow.session.flush()
