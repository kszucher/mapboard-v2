from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from sqlalchemy import update

from app import models
from app.constants import EventName, NodeType
from app.db import engine
from app.exceptions import NotFoundError, ValidationError
from app.expressions.schemas import ExpressionCreate, ExpressionUpdate

if TYPE_CHECKING:
    from app.context import UnitOfWork


def validate_expressions_for_node_type(
    node_type: str, expressions: list[models.Expression] | list[ExpressionCreate]
) -> None:
    expr_types = [e.type for e in expressions]
    base_inputs = [t for t in expr_types if t == "BASE_INPUT"]
    sub_inputs = [t for t in expr_types if t == "SUB_INPUT"]
    sub_unconnecteds = [t for t in expr_types if t == "SUB_UNCONNECTED"]
    base_outputs = [t for t in expr_types if t == "BASE_OUTPUT"]
    sub_outputs = [t for t in expr_types if t == "SUB_OUTPUT"]
    base_input_outputs = [t for t in expr_types if t == "BASE_INPUT_OUTPUT"]

    if node_type == NodeType.START:
        if len(base_outputs) != 1 or len(expressions) != 1:
            raise ValidationError("START node must have exactly 1 BASE_OUTPUT expression")
    elif node_type == NodeType.END:
        if len(base_inputs) != 1 or len(expressions) != 1:
            raise ValidationError("END node must have exactly 1 BASE_INPUT expression")
    elif node_type in (NodeType.LOGIC, NodeType.AGENT):
        if len(base_input_outputs) != 1 or len(expressions) != 1:
            raise ValidationError(f"{node_type} node must have exactly 1 BASE_INPUT_OUTPUT expression")
    elif node_type in (NodeType.LOGICAL_SWITCH, NodeType.AGENTIC_SWITCH):
        if len(base_inputs) != 1:
            raise ValidationError(f"{node_type} node must have exactly 1 BASE_INPUT expression")
        if len(sub_outputs) < 1:
            raise ValidationError(f"{node_type} node must have at least 1 SUB_OUTPUT expression")
        if len(expressions) != 1 + len(sub_outputs):
            raise ValidationError(f"{node_type} node can only have 1 BASE_INPUT and SUB_OUTPUT expressions")
    elif node_type in (NodeType.LOGICAL_JOIN, NodeType.AGENTIC_JOIN):
        if len(base_outputs) != 1:
            raise ValidationError(f"{node_type} node must have exactly 1 BASE_OUTPUT expression")
        if len(sub_inputs) < 1:
            raise ValidationError(f"{node_type} node must have at least 1 SUB_INPUT expression")
        if len(expressions) != 1 + len(sub_inputs):
            raise ValidationError(f"{node_type} node can only have 1 BASE_OUTPUT and SUB_INPUT expressions")
    elif node_type in (NodeType.TRANSFORM_AGENT_TO_LOGICAL, NodeType.TRANSFORM_LOGICAL_TO_AGENT):
        if len(base_inputs) != 1:
            raise ValidationError(f"{node_type} node must have exactly 1 BASE_INPUT expression")
        if len(base_outputs) != 1:
            raise ValidationError(f"{node_type} node must have exactly 1 BASE_OUTPUT expression")
        if len(sub_unconnecteds) < 1:
            raise ValidationError(f"{node_type} node must have at least 1 SUB_UNCONNECTED expression")
        if len(expressions) != 2 + len(sub_unconnecteds):
            raise ValidationError(
                f"{node_type} node can only have 1 BASE_INPUT, 1 BASE_OUTPUT, and SUB_UNCONNECTED expressions"
            )
    else:
        raise ValidationError(f"Unknown node_type: {node_type}")


async def create_expression(uow: UnitOfWork, data: ExpressionCreate) -> models.Expression:
    node = await uow.nodes.get(data.node_id)
    if not node:
        raise NotFoundError(f"Node {data.node_id} not found")

    expressions = await uow.expressions.list_by_node(data.node_id)
    validate_expressions_for_node_type(node.node_type, expressions + [data])

    if data.idx is None:
        same_type_exprs = [e for e in expressions if e.type == data.type]
        data.idx = len(same_type_exprs)
    else:
        await uow.expressions.shift_indices_before_insertion(data.node_id, data.idx, data.type)

    expr = await uow.expressions.create(data)

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=node.graph_id,
        payload={},
    )
    return expr


async def update_expression(
    uow: UnitOfWork, expression_id: uuid.UUID, data: ExpressionUpdate
) -> models.Expression | None:
    update_data = data.model_dump(exclude_unset=True)
    if not update_data:
        return await uow.expressions.get(expression_id)

    stmt = (
        update(models.Expression)
        .where(models.Expression.id == expression_id)
        .values(**update_data)
        .returning(models.Expression)
    )

    async with engine.execution_options(isolation_level="AUTOCOMMIT").connect() as conn:
        result = await conn.execute(stmt)
        row = result.fetchone()
        if not row:
            return None

        expr = models.Expression(
            id=row.id,
            node_id=row.node_id,
            graph_id=row.graph_id,
            idx=row.idx,
            type=row.type,
            raw_string=row.raw_string,
        )

    await uow.broker.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=expr.graph_id,
        payload={},
        sender_client_id=uow.sender_client_id,
    )
    return expr


async def delete_expression(uow: UnitOfWork, expression_id: uuid.UUID) -> None:
    expr = await uow.expressions.get(expression_id)
    if not expr:
        return

    if expr.type.startswith("BASE_"):
        raise ValidationError("Cannot delete the base expression of a node")

    node = await uow.nodes.get(expr.node_id)
    if not node:
        return

    expressions = await uow.expressions.list_by_node(expr.node_id)
    same_type_exprs = [e for e in expressions if e.type == expr.type]
    if len(same_type_exprs) <= 1:
        raise ValidationError("Cannot delete the last remaining expression of this type")

    deleted_idx = expr.idx

    # Delete the expression
    await uow.expressions.delete(expression_id)

    # Shift subsequent expressions natively in DB
    await uow.expressions.shift_indices_after_deletion(expr.node_id, deleted_idx, expr.type)

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=node.graph_id,
        payload={},
    )


async def create_default_expressions_for_node(
    uow: UnitOfWork,
    node: models.Node,
    base_expression_id: uuid.UUID | None = None,
    sub_expression_id: uuid.UUID | None = None,
    base_output_expression_id: uuid.UUID | None = None,
) -> None:
    if node.node_type == NodeType.START:
        await uow.expressions.create(
            ExpressionCreate(
                id=base_expression_id, node_id=node.id, graph_id=node.graph_id, idx=0, type="BASE_OUTPUT", raw_string=""
            )
        )
    elif node.node_type == NodeType.END:
        await uow.expressions.create(
            ExpressionCreate(
                id=base_expression_id, node_id=node.id, graph_id=node.graph_id, idx=0, type="BASE_INPUT", raw_string=""
            )
        )
    elif node.node_type in (NodeType.LOGIC, NodeType.AGENT):
        await uow.expressions.create(
            ExpressionCreate(
                id=base_expression_id,
                node_id=node.id,
                graph_id=node.graph_id,
                idx=0,
                type="BASE_INPUT_OUTPUT",
                raw_string="",
            )
        )
    elif node.node_type in (NodeType.LOGICAL_SWITCH, NodeType.AGENTIC_SWITCH):
        await uow.expressions.create(
            ExpressionCreate(
                id=base_expression_id, node_id=node.id, graph_id=node.graph_id, idx=0, type="BASE_INPUT", raw_string=""
            )
        )
        await uow.expressions.create(
            ExpressionCreate(
                id=sub_expression_id, node_id=node.id, graph_id=node.graph_id, idx=0, type="SUB_OUTPUT", raw_string=""
            )
        )
    elif node.node_type in (NodeType.LOGICAL_JOIN, NodeType.AGENTIC_JOIN):
        await uow.expressions.create(
            ExpressionCreate(
                id=sub_expression_id, node_id=node.id, graph_id=node.graph_id, idx=0, type="SUB_INPUT", raw_string=""
            )
        )
        await uow.expressions.create(
            ExpressionCreate(
                id=base_expression_id, node_id=node.id, graph_id=node.graph_id, idx=0, type="BASE_OUTPUT", raw_string=""
            )
        )
    elif node.node_type in (NodeType.TRANSFORM_AGENT_TO_LOGICAL, NodeType.TRANSFORM_LOGICAL_TO_AGENT):
        await uow.expressions.create(
            ExpressionCreate(
                id=base_expression_id, node_id=node.id, graph_id=node.graph_id, idx=0, type="BASE_INPUT", raw_string=""
            )
        )
        await uow.expressions.create(
            ExpressionCreate(
                id=sub_expression_id,
                node_id=node.id,
                graph_id=node.graph_id,
                idx=0,
                type="SUB_UNCONNECTED",
                raw_string="",
            )
        )
        await uow.expressions.create(
            ExpressionCreate(
                id=base_output_expression_id,
                node_id=node.id,
                graph_id=node.graph_id,
                idx=0,
                type="BASE_OUTPUT",
                raw_string="",
            )
        )


async def swap_expression_indices(uow: UnitOfWork, expression_id: uuid.UUID, direction: str) -> bool:
    expr = await uow.expressions.get(expression_id)
    if not expr:
        return False

    if expr.type.startswith("BASE_"):
        return False

    node = await uow.nodes.get(expr.node_id)
    if not node:
        return False

    expressions = await uow.expressions.list_by_node(expr.node_id)
    same_type_exprs = [e for e in expressions if e.type == expr.type]

    idx = -1
    for i, e in enumerate(same_type_exprs):
        if e.id == expression_id:
            idx = i
            break

    if idx == -1:
        return False

    target_idx = -1
    if direction == "up" and idx > 0:
        target_idx = idx - 1
    elif direction == "down" and idx < len(same_type_exprs) - 1:
        target_idx = idx + 1

    if target_idx == -1:
        return False

    other = same_type_exprs[target_idx]
    await uow.expressions.swap_indices(expr, other)

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=node.graph_id,
        payload={},
    )
    return True


async def list_expressions_by_graph(uow: UnitOfWork, graph_id: uuid.UUID) -> list[models.Expression]:
    return await uow.expressions.list_by_graph(graph_id)
