from __future__ import annotations

import logging
import uuid
from typing import TYPE_CHECKING

from app import models
from app.constants import EventName, NodeType
from app.expressions import service as expression_service
from app.nodes.schemas import NodeCreate

if TYPE_CHECKING:
    from app.context import UnitOfWork

logger = logging.getLogger(__name__)


async def list_nodes(uow: UnitOfWork, graph_id: uuid.UUID) -> list[models.Node]:
    return await uow.nodes.list_by_graph(graph_id)


async def create_node(uow: UnitOfWork, data: NodeCreate) -> uuid.UUID:
    # Calculate next iid to avoid duplicates
    all_nodes = await uow.nodes.list_by_graph(data.graph_id)
    next_iid = max([n.iid for n in all_nodes], default=0) + 1
    data.iid = next_iid

    # Repository now handles the simplified node creation
    node = await uow.nodes.create(data)

    # Isolate expression creation to its own service logic
    await expression_service.create_default_expressions_for_node(uow, node)

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=node.graph_id,
        payload={},
    )
    return node.id


async def delete_node(uow: UnitOfWork, node_id: uuid.UUID) -> None:
    node = await uow.nodes.get(node_id)
    if not node:
        return

    await uow.edges.delete_by_node(node_id)
    await uow.nodes.delete(node_id)

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=node.graph_id,
        payload={},
    )


async def cleanup_duplicate_iids_for_graph(uow: UnitOfWork, graph_id: uuid.UUID) -> None:
    nodes = await uow.nodes.list_by_graph(graph_id)
    iids = [n.iid for n in nodes]
    if len(iids) != len(set(iids)):
        logger.info("Found duplicate iids in graph %s, cleaning up...", graph_id)
        sorted_nodes = sorted(
            nodes,
            key=lambda n: (0 if n.node_type == NodeType.START else 1, n.iid, n.id),
        )
        for idx, node in enumerate(sorted_nodes, start=1):
            if node.iid != idx:
                node.iid = idx
        await uow.session.flush()
