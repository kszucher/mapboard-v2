from __future__ import annotations

import uuid
from typing import TYPE_CHECKING

from app.constants import EventName
from app.graphs.schemas import GraphSyncPayload

if TYPE_CHECKING:
    from app.context import UnitOfWork


DEFAULT_STARTER_CODE = """from typing import TypedDict
from langgraph.graph import StateGraph, START, END

# ----------------------------------------------------
# State Definition
# ----------------------------------------------------
class State(TypedDict):
    x: int

# ----------------------------------------------------
# Nodes
# ----------------------------------------------------
def process_step(state: State) -> dict:
    return {"x": state["x"] + 1}

# ----------------------------------------------------
# Graph Definition
# ----------------------------------------------------
workflow = StateGraph(State)

# Add Step Node
workflow.add_node("process_step", process_step)

# START -> process_step
workflow.add_edge(START, "process_step")

# process_step -> END
workflow.add_edge("process_step", END)

app = workflow.compile()
"""


async def create_graph(
    uow: UnitOfWork,
    user_id: uuid.UUID,
    graph_name: str,
) -> uuid.UUID:
    graph = await uow.graphs.create(user_id=user_id, name=graph_name)

    from app.graphs.langgraph_sync import parse_code_to_graph

    parsed = parse_code_to_graph(DEFAULT_STARTER_CODE)
    initial_flow = {
        "code": DEFAULT_STARTER_CODE,
        "nodes": parsed["nodes"],
        "edges": parsed["edges"],
        "variables": parsed["variables"],
        "functions": parsed["functions"],
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
) -> dict:
    graph = await uow.graphs.get(graph_id)
    if not graph:
        from app.exceptions import ValidationError

        raise ValidationError(f"Graph {graph_id} not found")

    from app.graphs.langgraph_sync import generate_graph_code, parse_code_to_graph

    existing_flow = graph.flow_json or {}
    existing_code = existing_flow.get("code", "")

    new_code = payload.code

    if new_code != existing_code:
        # Code edited in the frontend editor
        try:
            parsed = parse_code_to_graph(new_code)
            flow_data = {
                "code": new_code,
                "nodes": parsed["nodes"],
                "edges": parsed["edges"],
                "variables": parsed["variables"],
                "functions": parsed["functions"],
            }
        except ValueError as e:
            from fastapi import HTTPException

            raise HTTPException(status_code=422, detail=str(e))
    else:
        # Visual edit on the canvas
        payload_dict = payload.model_dump(mode="json")
        generated = generate_graph_code(payload_dict, existing_code=existing_code)

        try:
            parsed = parse_code_to_graph(generated)
            flow_data = {
                "code": generated,
                "nodes": parsed["nodes"],
                "edges": parsed["edges"],
                "variables": parsed["variables"],
                "functions": parsed["functions"],
            }
        except ValueError:
            # Fallback
            flow_data = payload_dict
            flow_data["code"] = generated

    graph.flow_json = flow_data
    await uow.session.flush()

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=graph_id,
        payload={},
    )
    return flow_data
