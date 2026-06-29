from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app import models
from app.constants import EventName
from app.edges.schemas import EdgeCreate
from app.exceptions import NotFoundError, ValidationError

if TYPE_CHECKING:
    from app.context import UnitOfWork


async def list_edges(uow: UnitOfWork, graph_id: uuid.UUID) -> list[models.Edge]:
    return await uow.edges.list_by_graph(graph_id)


async def create_edge(uow: UnitOfWork, data: EdgeCreate) -> uuid.UUID:
    # 1. Verify expressions exist
    from_expr = await uow.expressions.get(data.from_expression_id)
    to_expr = await uow.expressions.get(data.to_expression_id)
    if not from_expr:
        raise NotFoundError(f"Source expression {data.from_expression_id} not found")
    if not to_expr:
        raise NotFoundError(f"Target expression {data.to_expression_id} not found")

    # 2. Verify nodes exist and belong to the same graph
    from_node = await uow.nodes.get(from_expr.node_id)
    to_node = await uow.nodes.get(to_expr.node_id)
    if not from_node or from_node.graph_id != data.graph_id:
        raise ValidationError("Source expression does not belong to this graph")
    if not to_node or to_node.graph_id != data.graph_id:
        raise ValidationError("Target expression does not belong to this graph")

    # 3. Create the edge
    edge = await uow.edges.create(data)
    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=edge.graph_id,
        payload={},
    )
    return edge.id


async def delete_edge(uow: UnitOfWork, edge_id: uuid.UUID) -> None:
    edge = await uow.session.get(models.Edge, edge_id)
    await uow.edges.delete(edge_id)

    graph_id = edge.graph_id if edge else None
    if graph_id:
        uow.emit(
            event=EventName.GRAPH_UPDATED,
            graph_id=graph_id,
            payload={},
        )
