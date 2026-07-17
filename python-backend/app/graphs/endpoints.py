import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_uow
from app.graphs import service as graph_service
from app.graphs.compiler import compile_flow_with_langgraph
from app.graphs.schemas import GraphCreate, GraphFlowRead, GraphRead, GraphSyncPayload

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
    graph = await uow.graphs.get(graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")
    return GraphFlowRead.model_validate(graph.flow_json)


@router.put("/{graph_id}/sync", response_model=GraphFlowRead)
async def sync_graph_flow_endpoint(
    graph_id: uuid.UUID, payload: GraphSyncPayload, uow: Any = Depends(get_uow)
) -> GraphFlowRead:
    updated_flow = await graph_service.sync_graph_flow(uow, graph_id, payload)
    await uow.commit()
    return GraphFlowRead.model_validate(updated_flow)


@router.post("/{graph_id}/run", response_model=dict[str, Any])
async def run_graph(graph_id: uuid.UUID, uow: Any = Depends(get_uow)) -> dict[str, Any]:
    graph = await uow.graphs.get(graph_id)
    if not graph:
        raise HTTPException(status_code=404, detail="Graph not found")

    flow_json = (
        dict(graph.flow_json) if graph.flow_json else {"nodes": [], "edges": [], "variables": [], "functions": []}
    )

    try:
        app = compile_flow_with_langgraph(flow_json)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Compilation Error: {str(e)}")

    variables = flow_json.get("variables", [])
    initial_input = {v["name"]: v.get("value") for v in variables}

    try:
        final_state = await app.ainvoke(initial_input)
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Execution Error: {str(e)}")

    updated_variables = []
    for var in variables:
        val = final_state.get(var["name"], var.get("value"))
        var["value"] = val
        updated_variables.append(var)

    flow_json["variables"] = updated_variables
    graph.flow_json = flow_json
    await uow.session.flush()
    await uow.commit()

    return {"variables": updated_variables}
