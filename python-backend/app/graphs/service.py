from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app.constants import EventName, NodeType
from app.edges.schemas import EdgeCreate
from app.expressions.schemas import ExpressionCreate
from app.graphs.schemas import GraphSyncPayload
from app.nodes.schemas import NodeCreate

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


async def sync_graph_flow(
    uow: UnitOfWork,
    graph_id: uuid.UUID,
    payload: GraphSyncPayload,
) -> None:
    # 1. Fetch current database state
    current_nodes = await uow.nodes.list_by_graph(graph_id)
    current_edges = await uow.edges.list_by_graph(graph_id)
    current_exprs = await uow.expressions.list_by_graph(graph_id)

    db_nodes_map = {n.id: n for n in current_nodes}
    db_edges_map = {e.id: e for e in current_edges}
    db_exprs_map = {expr.id: expr for expr in current_exprs}

    payload_nodes_map = {n.id: n for n in payload.nodes}
    payload_edges_map = {e.id: e for e in payload.edges}
    payload_exprs_map = {expr.id: expr for expr in payload.expressions}

    # --- DELETIONS (Bottom-Up: Edges -> Expressions -> Nodes) ---
    # 1. Edges to delete
    for db_edge_id in db_edges_map.keys():
        if db_edge_id not in payload_edges_map:
            await uow.edges.delete(db_edge_id)

    # 2. Expressions to delete
    for db_expr_id in db_exprs_map.keys():
        if db_expr_id not in payload_exprs_map:
            await uow.expressions.delete(db_expr_id)

    # 3. Nodes to delete
    for db_node_id in db_nodes_map.keys():
        if db_node_id not in payload_nodes_map:
            await uow.nodes.delete(db_node_id)

    # Flush deletes to DB to avoid FK conflicts
    await uow.session.flush()

    # --- INSERTIONS / UPDATES (Top-Down: Nodes -> Expressions -> Edges) ---
    # 1. Nodes insert/update
    for node_payload in payload.nodes:
        if node_payload.id in db_nodes_map:
            # Update existing node
            node = db_nodes_map[node_payload.id]
            node.iid = node_payload.iid
            node.color = node_payload.color
            node.label = node_payload.label
            node.is_processing = node_payload.is_processing
            node.node_type = node_payload.node_type
        else:
            # Insert new node
            await uow.nodes.create(
                NodeCreate(
                    id=node_payload.id,
                    graph_id=node_payload.graph_id,
                    iid=node_payload.iid,
                    color=node_payload.color,
                    label=node_payload.label,
                    is_processing=node_payload.is_processing,
                    node_type=node_payload.node_type,
                )
            )

    await uow.session.flush()

    # 2. Expressions insert/update
    for expr_payload in payload.expressions:
        if expr_payload.id in db_exprs_map:
            # Update existing expression
            expr = db_exprs_map[expr_payload.id]
            expr.raw_string = expr_payload.raw_string
            expr.idx = expr_payload.idx
            expr.type = expr_payload.type
        else:
            # Insert new expression
            await uow.expressions.create(
                ExpressionCreate(
                    id=expr_payload.id,
                    node_id=expr_payload.node_id,
                    idx=expr_payload.idx,
                    type=expr_payload.type,
                    raw_string=expr_payload.raw_string,
                )
            )

    await uow.session.flush()

    # 3. Edges insert/update
    for edge_payload in payload.edges:
        if edge_payload.id in db_edges_map:
            # Update existing edge
            edge = db_edges_map[edge_payload.id]
            edge.from_node_id = edge_payload.from_node_id
            edge.to_node_id = edge_payload.to_node_id
            edge.handle_index = edge_payload.handle_index
            edge.from_expression_id = edge_payload.from_expression_id
            edge.to_expression_id = edge_payload.to_expression_id
        else:
            # Insert new edge
            await uow.edges.create(
                EdgeCreate(
                    id=edge_payload.id,
                    graph_id=edge_payload.graph_id,
                    from_node_id=edge_payload.from_node_id,
                    to_node_id=edge_payload.to_node_id,
                    handle_index=edge_payload.handle_index,
                    from_expression_id=edge_payload.from_expression_id,
                    to_expression_id=edge_payload.to_expression_id,
                )
            )

    await uow.session.flush()

    # Emit the single graph updated event
    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=graph_id,
        payload={},
    )
