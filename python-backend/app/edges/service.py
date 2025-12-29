from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.edges.repository import EdgeRepository
from app.edges.schemas import EdgeCreate

from app.schemas import GraphEvent
from app.events import GraphEventBroker


async def list_edges(session: AsyncSession, graph_id: uuid.UUID) -> list[models.Edge]:
    repo = EdgeRepository(session)
    return await repo.list_by_graph(graph_id)


async def create_edge(
    session: AsyncSession, data: EdgeCreate, broker: GraphEventBroker, sender_client_id: str | None = None
) -> uuid.UUID:
    repo = EdgeRepository(session)
    edge = await repo.create(data)
    await session.commit()
    await broker.broadcast(
        GraphEvent(
            event="edge_created",
            graph_id=edge.graph_id,
            payload={"edgeId": str(edge.id)},
            sender_client_id=sender_client_id,
        )
    )
    return edge.id


async def delete_edge(
    session: AsyncSession, edge_id: uuid.UUID, broker: GraphEventBroker, sender_client_id: str | None = None
) -> None:
    repo = EdgeRepository(session)
    edge = await session.get(models.Edge, edge_id)
    await repo.delete(edge_id)
    await session.commit()
    graph_id = edge.graph_id if edge else None
    if graph_id:
        await broker.broadcast(
            GraphEvent(
                event="edge_deleted",
                graph_id=graph_id,
                payload={"edgeId": str(edge_id)},
                sender_client_id=sender_client_id,
            )
        )
