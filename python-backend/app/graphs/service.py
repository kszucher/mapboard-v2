from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.graphs.repository import GraphRepository
from app.nodes.repository import NodeRepository
from app.users.repository import UserRepository
from app.schemas import GraphEvent
from app.events import GraphEventBroker
from app.nodes.schemas import NodeCreate


async def create_graph(
    session: AsyncSession,
    user_id: uuid.UUID,
    graph_name: str,
    broker: GraphEventBroker,
    sender_client_id: str | None = None,
) -> uuid.UUID:
    graphs_repo = GraphRepository(session)
    nodes_repo = NodeRepository(session)
    users_repo = UserRepository(session)

    graph = await graphs_repo.create(user_id=user_id, name=graph_name)

    await nodes_repo.create(
        NodeCreate(
            graph_id=graph.id,
            node_type="START",
            color="gray",
            iid=1,
            width=200,
            height=200,
            offset_x=100,
            offset_y=100,
            label="Start",
            is_processing=False,
        )
    )

    await users_repo.set_active_graph(user_id, graph.id)
    await session.commit()

    await broker.broadcast(
        GraphEvent(
            event="graph_created",
            graph_id=graph.id,
            payload={"graphId": str(graph.id)},
            sender_client_id=sender_client_id,
        )
    )
    return graph.id


async def list_graphs_by_user(session: AsyncSession, user_id: uuid.UUID) -> list:
    repo = GraphRepository(session)
    return await repo.list_by_user(user_id)
