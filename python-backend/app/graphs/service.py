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

    import uuid as py_uuid

    default_nodes = [
        {"id": "start", "node_type": "START", "is_input": False, "is_output": True, "slots": [], "code": ""},
        {
            "id": "process_step",
            "node_type": "STEP",
            "is_input": True,
            "is_output": True,
            "slots": [],
            "code": 'def process_step(state: State) -> dict:\n    return {"x": state["x"] + 1}',
        },
        {"id": "end", "node_type": "END", "is_input": True, "is_output": False, "slots": [], "code": ""},
    ]
    default_edges = [
        {
            "id": str(py_uuid.uuid5(py_uuid.NAMESPACE_DNS, "start->process_step")),
            "source_id": "start",
            "source_type": "node",
            "target_id": "process_step",
            "target_type": "node",
        },
        {
            "id": str(py_uuid.uuid5(py_uuid.NAMESPACE_DNS, "process_step->end")),
            "source_id": "process_step",
            "source_type": "node",
            "target_id": "end",
            "target_type": "node",
        },
    ]

    initial_flow = {
        "code": DEFAULT_STARTER_CODE,
        "nodes": default_nodes,
        "edges": default_edges,
        "variables": [{"id": "x", "name": "x", "type": "number", "value": None}],
        "functions": [],
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
    payload_dict = payload.model_dump(mode="json")

    if new_code != existing_code:
        # Code edited in the frontend editor
        try:
            parsed = parse_code_to_graph(new_code)

            nodes = payload_dict.get("nodes", [])
            edges = payload_dict.get("edges", [])
            functions = []

            # Match function sources to the visual nodes, updating their code field
            node_names = {n["id"] for n in nodes if n["node_type"] in ("STEP", "SWITCH")}
            for node in nodes:
                node_name = node["id"]
                if node_name in parsed["functions"]:
                    node["code"] = parsed["functions"][node_name]

            # Any top-level functions that are not visual nodes become helper functions
            for func_name, func_source in parsed["functions"].items():
                if func_name not in node_names and func_name != "State":
                    functions.append({"id": func_name, "name": func_name, "raw_string": func_source})

            # Regenerate the code block to ensure the read-only Graph Definition section matches payload topology
            temp_payload = {
                "nodes": nodes,
                "edges": edges,
                "variables": parsed["variables"],
                "functions": functions,
            }
            final_code = generate_graph_code(
                temp_payload, existing_code=new_code, old_nodes=existing_flow.get("nodes", [])
            )

            flow_data = {
                "code": final_code,
                "nodes": nodes,
                "edges": edges,
                "variables": parsed["variables"],
                "functions": functions,
            }
        except ValueError as e:
            from fastapi import HTTPException

            raise HTTPException(status_code=422, detail=str(e))
    else:
        # Visual edit on the canvas (e.g. node created, deleted, connected, slot modified)
        generated = generate_graph_code(
            payload_dict, existing_code=existing_code, old_nodes=existing_flow.get("nodes", [])
        )

        parsed = parse_code_to_graph(generated)

        nodes = payload_dict.get("nodes", [])
        edges = payload_dict.get("edges", [])
        node_names = {n["id"] for n in nodes if n["node_type"] in ("STEP", "SWITCH")}
        for node in nodes:
            node_name = node["id"]
            if node_name in parsed["functions"]:
                node["code"] = parsed["functions"][node_name]

        # Helper functions
        functions = []
        for func_name, func_source in parsed["functions"].items():
            if func_name not in node_names and func_name != "State":
                functions.append({"id": func_name, "name": func_name, "raw_string": func_source})

        flow_data = {
            "code": generated,
            "nodes": nodes,
            "edges": edges,
            "variables": parsed["variables"],
            "functions": functions,
        }

    graph.flow_json = flow_data
    await uow.session.flush()

    uow.emit(
        event=EventName.GRAPH_UPDATED,
        graph_id=graph_id,
        payload={},
    )
    return flow_data
