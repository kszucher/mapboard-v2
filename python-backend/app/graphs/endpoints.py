import uuid
from typing import Any

from fastapi import APIRouter, Depends, status

from app.db import get_uow
from app.graphs import service as graph_service
from app.graphs.schemas import (
    GraphCreate,
    GraphFlowRead,
    GraphRead,
    GraphSyncPayload,
    NodeCreateRequest,
    NodeUpdateRequest,
    SlotCreateRequest,
    SlotMoveRequest,
    SlotUpdateRequest,
)

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
    flow = await graph_service.get_and_reset_graph_flow(uow, graph_id)
    await uow.commit()
    return GraphFlowRead.model_validate(flow)


@router.put("/{graph_id}/sync", response_model=GraphFlowRead)
async def sync_graph_flow_endpoint(
    graph_id: uuid.UUID, payload: GraphSyncPayload, uow: Any = Depends(get_uow)
) -> GraphFlowRead:
    updated_flow = await graph_service.sync_graph_flow(uow, graph_id, payload)
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)


@router.post("/{graph_id}/run", response_model=dict[str, Any])
async def run_graph(graph_id: uuid.UUID, uow: Any = Depends(get_uow)) -> dict[str, Any]:
    flow_data = await graph_service.run_graph_flow(uow, graph_id)
    await uow.commit()
    return {"variables": flow_data.get("variables", [])}


@router.post("/{graph_id}/history/undo", response_model=GraphFlowRead)
async def undo_endpoint(graph_id: uuid.UUID, uow: Any = Depends(get_uow)) -> GraphFlowRead:
    updated_flow = await graph_service.undo_graph_flow(uow, graph_id)
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)


@router.post("/{graph_id}/history/redo", response_model=GraphFlowRead)
async def redo_endpoint(graph_id: uuid.UUID, uow: Any = Depends(get_uow)) -> GraphFlowRead:
    updated_flow = await graph_service.redo_graph_flow(uow, graph_id)
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)


# Nodes REST API
@router.post("/{graph_id}/nodes", response_model=GraphFlowRead)
async def add_node_endpoint(
    graph_id: uuid.UUID, payload: NodeCreateRequest, uow: Any = Depends(get_uow)
) -> GraphFlowRead:
    updated_flow = await graph_service.add_node(
        uow, graph_id, payload.node_type, payload.connector_id, payload.direction
    )
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)


@router.patch("/{graph_id}/nodes/{node_id}", response_model=GraphFlowRead)
async def update_node_endpoint(
    graph_id: uuid.UUID, node_id: str, payload: NodeUpdateRequest, uow: Any = Depends(get_uow)
) -> GraphFlowRead:
    updated_flow = await graph_service.update_node(uow, graph_id, node_id, payload.model_dump(exclude_unset=True))
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)


@router.delete("/{graph_id}/nodes/{node_id}", response_model=GraphFlowRead)
async def delete_node_endpoint(graph_id: uuid.UUID, node_id: str, uow: Any = Depends(get_uow)) -> GraphFlowRead:
    updated_flow = await graph_service.delete_node(uow, graph_id, node_id)
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)


@router.post("/{graph_id}/nodes/{node_id}/shortcircuit", response_model=GraphFlowRead)
async def shortcircuit_node_endpoint(graph_id: uuid.UUID, node_id: str, uow: Any = Depends(get_uow)) -> GraphFlowRead:
    updated_flow = await graph_service.shortcircuit_node(uow, graph_id, node_id)
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)


# Slots REST API
@router.post("/{graph_id}/nodes/{node_id}/slots", response_model=GraphFlowRead)
async def create_slot_endpoint(
    graph_id: uuid.UUID, node_id: str, payload: SlotCreateRequest, uow: Any = Depends(get_uow)
) -> GraphFlowRead:
    updated_flow = await graph_service.create_slot(uow, graph_id, node_id, payload.index)
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)


@router.patch("/{graph_id}/slots/{slot_id}", response_model=GraphFlowRead)
async def update_slot_endpoint(
    graph_id: uuid.UUID, slot_id: str, payload: SlotUpdateRequest, uow: Any = Depends(get_uow)
) -> GraphFlowRead:
    updated_flow = await graph_service.update_slot(uow, graph_id, slot_id, payload.raw_string)
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)


@router.delete("/{graph_id}/slots/{slot_id}", response_model=GraphFlowRead)
async def delete_slot_endpoint(graph_id: uuid.UUID, slot_id: str, uow: Any = Depends(get_uow)) -> GraphFlowRead:
    updated_flow = await graph_service.delete_slot(uow, graph_id, slot_id)
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)


@router.post("/{graph_id}/slots/{slot_id}/move", response_model=GraphFlowRead)
async def move_slot_endpoint(
    graph_id: uuid.UUID, slot_id: str, payload: SlotMoveRequest, uow: Any = Depends(get_uow)
) -> GraphFlowRead:
    updated_flow = await graph_service.move_slot(uow, graph_id, slot_id, payload.direction)
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)


# Edges REST API
@router.delete("/{graph_id}/edges/{edge_id}", response_model=GraphFlowRead)
async def delete_edge_endpoint(graph_id: uuid.UUID, edge_id: uuid.UUID, uow: Any = Depends(get_uow)) -> GraphFlowRead:
    updated_flow = await graph_service.delete_edge(uow, graph_id, edge_id)
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)
