from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app import models
from app.edges.schemas import EdgeCreate
from app.constants import EventName

if TYPE_CHECKING:
    from app.context import UnitOfWork


async def list_edges(uow: UnitOfWork, graph_id: uuid.UUID) -> list[models.Edge]:
    return await uow.edges.list_by_graph(graph_id)


async def create_edge(uow: UnitOfWork, data: EdgeCreate) -> uuid.UUID:
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
