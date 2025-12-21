from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.repositories.edges import EdgeRepository
from app.repositories.nodes import NodeRepository
from app.schemas import GraphEvent
from app.services.events import GraphEventBroker
import logging

logger = logging.getLogger(__name__)


def _validate_expressions_for_node_type(node_type: str, expressions: list[dict[str, Any]]) -> None:
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


def _normalize_expressions(expressions: list[dict[str, Any]]) -> list[dict[str, Any]]:
    # Keep stable ordering: prefer explicit idx; fall back to input order.
    if all("idx" in e for e in expressions):
        expressions = sorted(expressions, key=lambda e: int(e["idx"]))
    return [{"idx": i, "raw_string": str(e.get("raw_string", ""))} for i, e in enumerate(expressions)]


def _strip_deprecated_node_fields(data: dict[str, Any]) -> dict[str, Any]:
    deprecated = {
        "num_handles",
        "node_type_start",
        "node_type_logic_input",
        "node_type_agent_input",
        "node_type_logical_switch_input",
        "node_type_agentic_switch_input",
    }
    return {k: v for k, v in data.items() if k not in deprecated}


async def list_nodes(session: AsyncSession, graph_id: uuid.UUID):
    repo = NodeRepository(session)
    return await repo.list_by_graph(graph_id)


async def create_node(
    session: AsyncSession, data: dict[str, Any], broker: GraphEventBroker, sender_client_id: str | None = None
) -> uuid.UUID:
    repo = NodeRepository(session)

    data = _strip_deprecated_node_fields(data)
    expressions = data.pop("expressions", []) or []
    node_type = data.get("node_type")
    if not isinstance(node_type, str):
        raise ValueError("node_type is required")

    _validate_expressions_for_node_type(node_type, expressions)
    expressions = _normalize_expressions(expressions)

    node = await repo.create(data)
    for expr in expressions:
        session.add(models.Expression(node_id=node.id, idx=expr["idx"], raw_string=expr["raw_string"]))

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


async def update_node(
    session: AsyncSession,
    node_id: uuid.UUID,
    patch: dict[str, Any],
    broker: GraphEventBroker,
    sender_client_id: str | None = None,
) -> None:
    repo = NodeRepository(session)
    node = await repo.get(node_id)
    graph_id = node.graph_id if node else None

    if node is None:
        return

    patch_without_graph = {k: v for k, v in patch.items() if k != "graph_id"}
    patch_without_graph = _strip_deprecated_node_fields(patch_without_graph)

    expressions_patch = patch_without_graph.pop("expressions", None)
    effective_node_type = patch_without_graph.get("node_type", node.node_type)

    event_patch: dict[str, Any] = dict(patch_without_graph)

    # Update scalar fields
    protected_fields = {"id", "graph_id", "num_handles", "expressions"}
    for k, v in patch_without_graph.items():
        if k in protected_fields:
            continue
        if hasattr(node, k):
            try:
                setattr(node, k, v)
            except Exception as e:
                logger.warning("Failed to set attribute %s on node %s: %s", k, node_id, e)

    # Replace expressions if present
    if expressions_patch is not None:
        if not isinstance(expressions_patch, list):
            raise ValueError("expressions must be a list")
        _validate_expressions_for_node_type(str(effective_node_type), expressions_patch)
        normalized = _normalize_expressions(expressions_patch)

        event_patch["expressions"] = normalized

        node.expressions.clear()
        for expr in normalized:
            node.expressions.append(models.Expression(idx=expr["idx"], raw_string=expr["raw_string"]))

    await session.commit()

    if graph_id:
        await broker.broadcast(
            GraphEvent(
                event="node_updated",
                graph_id=graph_id,
                payload={"nodeId": str(node_id), "patch": event_patch},
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
