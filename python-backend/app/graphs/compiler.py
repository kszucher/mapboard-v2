from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

TYPE_MAP = {"number": int, "string": str, "boolean": bool}


def build_dynamic_state(variables: list[dict]) -> type:
    fields = {}
    for var in variables:
        fields[var["name"]] = TYPE_MAP.get(var["type"], Any)
    return TypedDict("GraphState", fields)


def extract_node_function(node_code: str) -> callable:
    if not node_code or not node_code.strip() or "# Read-only node" in node_code:
        return lambda state: {}

    # Define a clean namespace
    namespace = {}
    # Execute the code block in the namespace
    exec(node_code, {}, namespace)

    # Retrieve the function object
    for value in namespace.values():
        if callable(value):
            return value

    raise ValueError("No callable function definition found in code block.")


def compile_flow_with_langgraph(flow_json: dict):
    code = flow_json.get("code", "")
    if code:
        namespace = {}
        try:
            exec(code, {}, namespace)
        except Exception as e:
            raise ValueError(f"Execution failed: {str(e)}") from e

        # Find compiled Pregel app or StateGraph
        from langgraph.pregel import Pregel

        for val in namespace.values():
            if isinstance(val, Pregel):
                return val
            if isinstance(val, StateGraph):
                return val.compile()
        raise ValueError("Could not find compiled 'app' or 'workflow' object in python script.")

    # Fallback to visual parsing if no code is present (legacy)
    # 1. Build State TypedDict
    GraphState = build_dynamic_state(flow_json.get("variables", []))

    # 2. Instantiate StateGraph
    workflow = StateGraph(GraphState)

    # 3. Add Nodes
    node_functions = {}
    for node in flow_json.get("nodes", []):
        node_id = node["id"]
        node_type = node["node_type"]

        if node_type in ["STEP", "SWITCH"]:
            func = extract_node_function(node.get("code", ""))
            node_functions[node_id] = func
            workflow.add_node(node_id, func)

    # 4. Set Entry Point
    start_node = next((n for n in flow_json.get("nodes", []) if n["node_type"] == "START"), None)
    if start_node:
        start_edge = next((e for e in flow_json.get("edges", []) if e["source_id"] == start_node["id"]), None)
        if start_edge:
            workflow.set_entry_point(start_edge["target_id"])

    # 5. Resolve Slots and Edges
    slot_registry = {}
    for node in flow_json.get("nodes", []):
        for slot in node.get("slots", []):
            slot_registry[slot["id"]] = {"node_id": node["id"], "label": slot["raw_string"]}

    conditional_edges = {}  # { source_node_uuid: { slot_label: target_node_uuid } }

    for edge in flow_json.get("edges", []):
        source_id = edge["source_id"]
        target_id = edge["target_id"]

        # Check target node type (e.g. if connected to visual END node)
        target_node = next((n for n in flow_json.get("nodes", []) if n["id"] == target_id), None)
        resolved_target = END if (target_node and target_node["node_type"] == "END") else target_id

        # Check if routing from a SWITCH node slot
        if source_id in slot_registry:
            slot_info = slot_registry[source_id]
            source_node_uuid = slot_info["node_id"]
            label = slot_info["label"]

            if source_node_uuid not in conditional_edges:
                conditional_edges[source_node_uuid] = {}
            conditional_edges[source_node_uuid][label] = resolved_target
        else:
            # Static Edge (e.g. Node-to-Node or Node-to-Join slot)
            workflow.add_edge(source_id, resolved_target)

    # 6. Add Conditional Edges
    for source_uuid, path_map in conditional_edges.items():
        router_func = node_functions.get(source_uuid)
        if router_func:
            workflow.add_conditional_edges(source_uuid, router_func, path_map)

    return workflow.compile()
