from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app import models
from app.constants import EventName, NodeType
from app.exceptions import NotFoundError, ValidationError
from app.expressions.schemas import ExpressionCreate, ExpressionUpdate

if TYPE_CHECKING:
    from app.context import UnitOfWork


def validate_expressions_for_node_type(
    node_type: str, expressions: list[models.Expression] | list[ExpressionCreate]
) -> None:
    base_exprs = [e for e in expressions if e.type == "BASE"]
    sub_exprs = [e for e in expressions if e.type == "SUB"]

    if node_type == NodeType.START:
        if len(expressions) != 0:
            raise ValidationError("START nodes must have 0 expressions")
    elif node_type in {NodeType.LOGIC, NodeType.AGENT}:
        if len(base_exprs) != 1 or len(sub_exprs) != 0:
            raise ValidationError(f"{node_type} nodes must have exactly 1 BASE expression and 0 SUB expressions")
    elif node_type in {NodeType.LOGICAL_SWITCH, NodeType.AGENTIC_SWITCH}:
        if len(base_exprs) != 1:
            raise ValidationError(f"{node_type} nodes must have exactly 1 BASE expression")
    else:
        raise ValidationError(f"Unknown node_type: {node_type}")


async def create_expression(uow: UnitOfWork, data: ExpressionCreate) -> models.Expression:
    node = await uow.nodes.get(data.node_id)
    if not node:
        raise NotFoundError(f"Node {data.node_id} not found")

    if data.idx is None:
        expressions = await uow.expressions.list_by_node(data.node_id)
        sub_exprs = [e for e in expressions if e.type == "SUB"]
        data.idx = len(sub_exprs)

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
    expr = await uow.expressions.update(expression_id, data)
    if not expr:
        return None

    node = await uow.nodes.get(expr.node_id)
    if node:
        uow.emit(
            event=EventName.GRAPH_UPDATED,
            graph_id=node.graph_id,
            payload={},
        )
    return expr


async def delete_expression(uow: UnitOfWork, expression_id: uuid.UUID) -> None:
    expr = await uow.expressions.get(expression_id)
    if not expr:
        return

    if expr.type == "BASE":
        raise ValidationError("Cannot delete the base expression of a node")

    node = await uow.nodes.get(expr.node_id)
    if not node:
        return

    deleted_idx = expr.idx

    # Delete the expression
    await uow.expressions.delete(expression_id)

    # Shift subsequent expressions natively in DB
    await uow.expressions.shift_indices_after_deletion(expr.node_id, deleted_idx)

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=node.graph_id,
        payload={},
    )


async def create_default_expressions_for_node(uow: UnitOfWork, node: models.Node) -> None:
    if node.node_type != NodeType.START:
        await uow.expressions.create(ExpressionCreate(node_id=node.id, idx=0, type="BASE", raw_string=""))


async def swap_expression_indices(uow: UnitOfWork, expression_id: uuid.UUID, direction: str) -> bool:
    expr = await uow.expressions.get(expression_id)
    if not expr:
        return False

    if expr.type == "BASE":
        return False

    node = await uow.nodes.get(expr.node_id)
    if not node:
        return False

    expressions = await uow.expressions.list_by_node(expr.node_id)
    sub_exprs = [e for e in expressions if e.type == "SUB"]

    idx = -1
    for i, e in enumerate(sub_exprs):
        if e.id == expression_id:
            idx = i
            break

    if idx == -1:
        return False

    target_idx = -1
    if direction == "up" and idx > 0:
        target_idx = idx - 1
    elif direction == "down" and idx < len(sub_exprs) - 1:
        target_idx = idx + 1

    if target_idx == -1:
        return False

    other = sub_exprs[target_idx]
    await uow.expressions.swap_indices(expr, other)

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=node.graph_id,
        payload={},
    )
    return True


async def list_expressions_by_graph(uow: UnitOfWork, graph_id: uuid.UUID) -> list[models.Expression]:
    return await uow.expressions.list_by_graph(graph_id)
