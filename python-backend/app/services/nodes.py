from __future__ import annotations

import uuid
from typing import Any

from app.repositories.edges import EdgeRepository
from app.repositories.nodes import NodeRepository
from app.schemas import GraphEvent
from app.services.events import GraphEventBroker
from sqlalchemy.ext.asyncio import AsyncSession


async def list_nodes(session: AsyncSession, graph_id: uuid.UUID):
    repo = NodeRepository(session)
    return await repo.list_by_graph(graph_id)


async def create_node(session: AsyncSession, data: dict[str, Any], broker: GraphEventBroker) -> uuid.UUID:
    repo = NodeRepository(session)
    node = await repo.create(data)
    await session.commit()
    await broker.broadcast(
        GraphEvent(event="node_created", graph_id=node.graph_id, payload={"nodeId": str(node.id)})
    )
    return node.id


async def update_node(session: AsyncSession, node_id: uuid.UUID, patch: dict[str, Any], broker: GraphEventBroker) -> None:
    repo = NodeRepository(session)
    node = await repo.get(node_id)
    graph_id = node.graph_id if node else None

    patch_without_graph = {k: v for k, v in patch.items() if k != "graph_id"}

    await repo.update(node_id, patch_without_graph)
    await session.commit()

    if graph_id:
        await broker.broadcast(
            GraphEvent(event="node_updated", graph_id=graph_id, payload={"nodeId": str(node_id), "patch": patch_without_graph})
        )


async def delete_node(session: AsyncSession, node_id: uuid.UUID, broker: GraphEventBroker) -> None:
    nodes_repo = NodeRepository(session)
    edges_repo = EdgeRepository(session)

    node = await nodes_repo.get(node_id)
    if node is None:
        return

    outgoing = await edges_repo.list_by_graph(node.graph_id)
    for edge in outgoing:
        if edge.from_node_id == node_id or edge.to_node_id == node_id:
            await edges_repo.delete(edge.id)

    await nodes_repo.delete(node_id)
    await session.commit()

    await broker.broadcast(
        GraphEvent(event="node_deleted", graph_id=node.graph_id, payload={"nodeId": str(node_id)})
    )

