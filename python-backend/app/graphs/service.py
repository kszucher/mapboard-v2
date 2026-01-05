from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app.nodes.schemas import NodeCreate
from app.constants import EventName, NodeType

if TYPE_CHECKING:
    from app.context import UnitOfWork


async def create_graph(
    uow: UnitOfWork,
    user_id: uuid.UUID,
    graph_name: str,
) -> uuid.UUID:
    graph = await uow.graphs.create(user_id=user_id, name=graph_name)

    await uow.nodes.create(
        NodeCreate(
            graph_id=graph.id,
            node_type=NodeType.START,
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

    await uow.users.set_active_graph(user_id, graph.id)

    uow.emit(
        event=EventName.GRAPH_CREATED,
        graph_id=graph.id,
        payload={"graphId": graph.id},
    )
    return graph.id


async def list_graphs_by_user(uow: UnitOfWork, user_id: uuid.UUID) -> list:
    return await uow.graphs.list_by_user(user_id)
