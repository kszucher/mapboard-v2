from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.edges.repository import EdgeRepository
from app.nodes.repository import NodeRepository
from app.schemas import GraphEvent
from app.events import GraphEventBroker
from app.nodes.schemas import NodeCreate, ExpressionCreate
import logging

logger = logging.getLogger(__name__)


def _validate_expressions_for_node_type(node_type: str, expressions: list[ExpressionCreate]) -> None:
    if node_type == "START":
        if len(expressions) != 0:
            raise ValueError("START nodes must have 0 expressions")
    elif node_type in {"LOGIC", "AGENT"}:
        if len(expressions) != 1:
            raise ValueError(f"{node_type} nodes must have exactly 1 expression")
    elif node_type in {"LOGICAL_SWITCH", "AGENTIC_SWITCH"}:
        return
    else:
        raise ValueError(f"Unknown node_type: {node_type}")


def _normalize_expressions(expressions: list[ExpressionCreate]) -> list[ExpressionCreate]:
    # Ensure they have sequential indices if they don't already
    return [ExpressionCreate(idx=i, raw_string=e.raw_string) for i, e in enumerate(expressions)]


def _strip_deprecated_node_fields(data: NodeCreate) -> NodeCreate:
    # Pydantic handles this via validation, but if we want to be explicit:
    return data
    deprecated = {
        "node_type_start",
        "node_type_logic_input",
        "node_type_agent_input",
        "node_type_logical_switch_input",
        "node_type_agentic_switch_input",
    }
    return {k: v for k, v in data.items() if k not in deprecated}


async def list_nodes(session: AsyncSession, graph_id: uuid.UUID) -> list[models.Node]:
    repo = NodeRepository(session)
    return await repo.list_by_graph(graph_id)


async def create_node(
    session: AsyncSession, data: NodeCreate, broker: GraphEventBroker, sender_client_id: str | None = None
) -> uuid.UUID:
    repo = NodeRepository(session)

    expressions = _normalize_expressions(data.expressions)
    _validate_expressions_for_node_type(str(data.node_type), expressions)

    node = await repo.create(data)
    for expr in expressions:
        session.add(models.Expression(node_id=node.id, idx=expr.idx, raw_string=expr.raw_string))

    await session.commit()
    await broker.broadcast(
        GraphEvent(
            event="node_created",
            graph_id=node.graph_id,
            payload={"nodeId": str(node.id)},
            sender_client_id=sender_client_id,
        )
    )
    return node.id


async def update_node_offset(
    session: AsyncSession,
    node_id: uuid.UUID,
    offset_x: int,
    offset_y: int,
    broker: GraphEventBroker,
    sender_client_id: str | None = None,
) -> None:
    repo = NodeRepository(session)
    node = await repo.get(node_id)
    
    if node is None:
        return
    
    node.offset_x = offset_x
    node.offset_y = offset_y
    
    await session.commit()
    
    await broker.broadcast(
        GraphEvent(
            event="node_updated",
            graph_id=node.graph_id,
            payload={"nodeId": str(node_id), "patch": {"offset_x": offset_x, "offset_y": offset_y}},
            sender_client_id=sender_client_id,
        )
    )


async def update_node_dimensions(
    session: AsyncSession,
    node_id: uuid.UUID,
    width: int,
    height: int,
    broker: GraphEventBroker,
    sender_client_id: str | None = None,
) -> None:
    repo = NodeRepository(session)
    node = await repo.get(node_id)
    
    if node is None:
        return
    
    node.width = width
    node.height = height
    
    await session.commit()
    
    await broker.broadcast(
        GraphEvent(
            event="node_updated",
            graph_id=node.graph_id,
            payload={"nodeId": str(node_id), "patch": {"width": width, "height": height}},
            sender_client_id=sender_client_id,
        )
    )


async def update_node_expressions(
    session: AsyncSession,
    node_id: uuid.UUID,
    expressions: list[ExpressionCreate],
    broker: GraphEventBroker,
    sender_client_id: str | None = None,
) -> None:
    repo = NodeRepository(session)
    node = await repo.get(node_id)
    
    if node is None:
        return
    
    _validate_expressions_for_node_type(str(node.node_type), expressions)
    normalized = _normalize_expressions(expressions)
    
    node.expressions.clear()
    for expr in normalized:
        node.expressions.append(models.Expression(idx=expr.idx, raw_string=expr.raw_string))

    await session.commit()

    await broker.broadcast(
        GraphEvent(
            event="node_updated",
            graph_id=node.graph_id,
            payload={"nodeId": str(node_id), "patch": {"expressions": [e.model_dump() for e in normalized]}},
            sender_client_id=sender_client_id,
        )
    )


async def update_node_label(
    session: AsyncSession,
    node_id: uuid.UUID,
    label: str,
    broker: GraphEventBroker,
    sender_client_id: str | None = None,
) -> None:
    repo = NodeRepository(session)
    node = await repo.get(node_id)
    
    if node is None:
        return
    
    node.label = label
    await session.commit()
    
    await broker.broadcast(
        GraphEvent(
            event="node_updated",
            graph_id=node.graph_id,
            payload={"nodeId": str(node_id), "patch": {"label": label}},
            sender_client_id=sender_client_id,
        )
    )


async def update_node_color(
    session: AsyncSession,
    node_id: uuid.UUID,
    color: str,
    broker: GraphEventBroker,
    sender_client_id: str | None = None,
) -> None:
    repo = NodeRepository(session)
    node = await repo.get(node_id)
    
    if node is None:
        return
    
    node.color = color
    await session.commit()
    
    await broker.broadcast(
        GraphEvent(
            event="node_updated",
            graph_id=node.graph_id,
            payload={"nodeId": str(node_id), "patch": {"color": color}},
            sender_client_id=sender_client_id,
        )
    )


async def delete_node(
    session: AsyncSession, node_id: uuid.UUID, broker: GraphEventBroker, sender_client_id: str | None = None
) -> None:
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
        GraphEvent(
            event="node_deleted",
            graph_id=node.graph_id,
            payload={"nodeId": str(node_id)},
            sender_client_id=sender_client_id,
        )
    )
