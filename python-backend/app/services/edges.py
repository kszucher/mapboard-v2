from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.repositories.edges import EdgeRepository
from app.repositories.nodes import NodeRepository
from app.schemas import GraphEvent
from app.services.events import GraphEventBroker


async def list_edges(session: AsyncSession, graph_id: uuid.UUID):
    repo = EdgeRepository(session)
    return await repo.list_by_graph(graph_id)


async def create_edge(session: AsyncSession, data: dict, broker: GraphEventBroker) -> uuid.UUID:
    repo = EdgeRepository(session)
    edge = await repo.create(data)
    await session.commit()
    await broker.broadcast(
        GraphEvent(event="edge_created", graph_id=edge.graph_id, payload={"edgeId": str(edge.id)})
    )
    return edge.id


async def delete_edge(session: AsyncSession, edge_id: uuid.UUID, broker: GraphEventBroker) -> None:
    repo = EdgeRepository(session)
    edge = await session.get(models.Edge, edge_id)
    await repo.delete(edge_id)
    await session.commit()
    graph_id = edge.graph_id if edge else None
    if graph_id:
        await broker.broadcast(GraphEvent(event="edge_deleted", graph_id=graph_id, payload={"edgeId": str(edge_id)}))


async def delete_edges_by_handle(
    session: AsyncSession, from_node_id: uuid.UUID, deleted_handle_index: int, broker: GraphEventBroker
) -> None:
    repo = EdgeRepository(session)
    node_repo = NodeRepository(session)
    node = await node_repo.get(from_node_id)
    graph_id = node.graph_id if node else None

    await repo.delete_by_from_handle(from_node_id, deleted_handle_index)
    await session.commit()

    if graph_id:
        await broker.broadcast(
            GraphEvent(
                event="edges_updated",
                graph_id=graph_id,
                payload={"fromNodeId": str(from_node_id), "deletedHandleIndex": deleted_handle_index},
            )
        )
