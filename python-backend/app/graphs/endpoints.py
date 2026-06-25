from __future__ import annotations

import uuid
from typing import Any

from fastapi import APIRouter, Depends, status

from app.db import get_uow
from app.edges import service as edge_service
from app.edges.schemas import EdgeRead
from app.expressions import service as expression_service
from app.expressions.schemas import ExpressionRead
from app.graphs import service as graph_service
from app.graphs.schemas import GraphCreate, GraphFlowRead, GraphRead, GraphSyncPayload
from app.nodes import service as node_service
from app.nodes.schemas import NodeRead

router = APIRouter(prefix="/graphs", tags=["graphs"])


@router.post("/", response_model=uuid.UUID, status_code=status.HTTP_201_CREATED)
async def create_graph(payload: GraphCreate, uow: Any = Depends(get_uow)) -> uuid.UUID:
    graph_id = await graph_service.create_graph(uow, payload.user_id, payload.graph_name)
    await uow.commit()
    return graph_id


@router.get("/user/{user_id}", response_model=list[GraphRead])
async def list_graphs(user_id: uuid.UUID, uow: Any = Depends(get_uow)) -> list[GraphRead]:
    graphs = await graph_service.list_graphs_by_user(uow, user_id)
    return [GraphRead.model_validate(g) for g in graphs]


@router.get("/{graph_id}/flow", response_model=GraphFlowRead)
async def get_graph_flow(graph_id: uuid.UUID, uow: Any = Depends(get_uow)) -> GraphFlowRead:
    nodes = await node_service.list_nodes(uow, graph_id)
    edges = await edge_service.list_edges(uow, graph_id)
    expressions = await expression_service.list_expressions_by_graph(uow, graph_id)

    return GraphFlowRead(
        nodes=[NodeRead.model_validate(n) for n in nodes],
        edges=[EdgeRead.model_validate(e) for e in edges],
        expressions=[ExpressionRead.model_validate(expr) for expr in expressions],
    )


@router.put("/{graph_id}/sync", status_code=status.HTTP_204_NO_CONTENT)
async def sync_graph_flow_endpoint(graph_id: uuid.UUID, payload: GraphSyncPayload, uow: Any = Depends(get_uow)) -> None:
    await graph_service.sync_graph_flow(uow, graph_id, payload)
    await uow.commit()
