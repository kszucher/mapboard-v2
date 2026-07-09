from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app.constants import EventName
from app.graphs.schemas import GraphSyncPayload

if TYPE_CHECKING:
    from app.context import UnitOfWork


async def create_graph(
    uow: UnitOfWork,
    user_id: uuid.UUID,
    graph_name: str,
) -> uuid.UUID:
    graph = await uow.graphs.create(user_id=user_id, name=graph_name)

    start_node_id = uuid.uuid4()
    start_expr_id = uuid.uuid4()
    initial_flow = {
        "nodes": [
            {
                "id": str(start_node_id),
                "node_type": "START",
                "expressions": [
                    {
                        "id": str(start_expr_id),
                        "is_input": False,
                        "is_output": True,
                        "raw_string": "",
                    }
                ],
            }
        ],
        "edges": [],
    }
    graph.flow_json = initial_flow
    await uow.session.flush()

    await uow.users.set_active_graph(user_id, graph.id)

    uow.emit(
        event=EventName.GRAPH_CREATED,
        graph_id=graph.id,
        payload={"graphId": graph.id},
    )
    return graph.id


async def list_graphs_by_user(uow: UnitOfWork, user_id: uuid.UUID) -> list:
    return await uow.graphs.list_by_user(user_id)


async def sync_graph_flow(
    uow: UnitOfWork,
    graph_id: uuid.UUID,
    payload: GraphSyncPayload,
) -> None:
    graph = await uow.graphs.get(graph_id)
    if not graph:
        from app.exceptions import ValidationError

        raise ValidationError(f"Graph {graph_id} not found")

    graph.flow_json = payload.model_dump(mode="json")
    await uow.session.flush()

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=graph_id,
        payload={},
    )
