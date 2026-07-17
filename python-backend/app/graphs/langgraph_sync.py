import ast
import traceback
from typing import Any

from langgraph.graph import StateGraph

TYPE_MAP_PY_TO_GB = {
    int: "number",
    float: "number",
    str: "string",
    bool: "boolean",
    "int": "number",
    "float": "number",
    "str": "string",
    "bool": "boolean",
}

TYPE_MAP_GB_TO_PY = {
    "number": "int",
    "string": "str",
    "boolean": "bool",
}


def parse_code_to_graph(code: str) -> dict[str, Any]:
    """
    Parses a single Python script representing a LangGraph workflow.
    Executes it to introspect the graph, and uses AST to extract function bodies.
    """
    if not code.strip():
        raise ValueError("Code is empty")

    # 1. AST parsing to check for syntax errors and extract raw function source codes
    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        raise ValueError(f"Syntax Error on line {e.lineno}: {e.msg}") from e

    # Extract all top-level function source codes
    lines = code.splitlines()
    function_sources: dict[str, str] = {}
    helper_functions: list[dict[str, Any]] = []

    for node in tree.body:
        if isinstance(node, ast.FunctionDef):
            # Extract function body and signature
            func_code = "\n".join(lines[node.lineno - 1 : node.end_lineno])
            function_sources[node.name] = func_code

    # 2. Dynamic execution to extract runtime LangGraph topology
    namespace = {}
    try:
        exec(code, {}, namespace)
    except Exception as e:
        tb = traceback.extract_tb(e.__traceback__)
        # Find the line number inside the executed script
        line_no = None
        for frame in tb:
            if frame.filename == "<string>":
                line_no = frame.lineno
                break
        err_msg = f"Runtime Error: {str(e)}"
        if line_no:
            err_msg = f"Runtime Error on line {line_no}: {str(e)}"
        raise ValueError(err_msg) from e

    # Find StateGraph instance
    workflow: StateGraph = None
    for val in namespace.values():
        if isinstance(val, StateGraph):
            workflow = val
            break

    if not workflow:
        raise ValueError("No StateGraph object ('workflow') defined or compiled in the code.")

    # 3. Extract variables from state schema
    variables: list[dict[str, Any]] = []
    state_schema = getattr(workflow, "state_schema", None)
    if state_schema and hasattr(state_schema, "__annotations__"):
        for var_name, var_type in state_schema.__annotations__.items():
            # Get type name
            type_str = getattr(var_type, "__name__", str(var_type))
            gb_type = TYPE_MAP_PY_TO_GB.get(type_str, "string")
            variables.append(
                {
                    "id": var_name,  # Use variable name as ID for simplicity
                    "name": var_name,
                    "type": gb_type,
                    "value": None,
                }
            )

    # 4. Extract nodes (Step vs Switch)
    nodes: list[dict[str, Any]] = []
    edges: list[dict[str, Any]] = []

    # Track which nodes are switches
    conditional_sources = set(workflow.branches.keys())

    # Always add visual START and END nodes
    start_node_id = "START"
    end_node_id = "END"
    nodes.append(
        {"id": start_node_id, "node_type": "START", "is_input": False, "is_output": True, "slots": [], "code": ""}
    )
    nodes.append({"id": end_node_id, "node_type": "END", "is_input": True, "is_output": False, "slots": [], "code": ""})

    # Add other nodes
    for node_name in workflow.nodes.keys():
        is_switch = node_name in conditional_sources
        slots = []

        # If it's a Switch node, find output slot labels from the branch configuration
        if is_switch:
            branch_info = workflow.branches[node_name]
            # branch_info is a dict, keys might be 'condition' or target label
            for _, branch_spec in branch_info.items():
                # branch_spec.ends maps routing labels to target nodes
                for label in branch_spec.ends.keys():
                    slots.append({"id": f"{node_name}_{label}", "raw_string": label, "selected": False})

        nodes.append(
            {
                "id": node_name,
                "node_type": "SWITCH" if is_switch else "STEP",
                "is_input": False,
                "is_output": False,
                "slots": slots,
                "code": function_sources.get(node_name, ""),
            }
        )

    # 5. Extract edges
    # Standard static edges
    for source, target in workflow.edges:
        src_id = start_node_id if source == "__start__" else source
        tgt_id = end_node_id if target == "__end__" else target
        edges.append(
            {
                "id": f"{src_id}->{tgt_id}",
                "source_id": src_id,
                "source_type": "node",
                "target_id": tgt_id,
                "target_type": "node",
            }
        )

    # Conditional edges
    for source_node, branches in workflow.branches.items():
        for _, branch_spec in branches.items():
            for label, target in branch_spec.ends.items():
                src_slot_id = f"{source_node}_{label}"
                tgt_id = end_node_id if target == "__end__" else target
                edges.append(
                    {
                        "id": f"{src_slot_id}->{tgt_id}",
                        "source_id": src_slot_id,
                        "source_type": "slot",
                        "target_id": tgt_id,
                        "target_type": "node",
                    }
                )

    # 6. Extract helper functions
    # Any top-level functions defined in the code but NOT added as graph nodes
    for func_name, func_source in function_sources.items():
        if func_name not in workflow.nodes and func_name != "State":
            helper_functions.append({"id": func_name, "name": func_name, "raw_string": func_source})

    return {
        "nodes": nodes,
        "edges": edges,
        "variables": variables,
        "functions": helper_functions,
    }


def generate_graph_code(payload: dict[str, Any], existing_code: str = "") -> str:
    """
    Generates a Python script from a visual graph payload.
    Uses existing_code to preserve helper functions and node function bodies if possible.
    """
    # Parse existing functions to preserve their code bodies/helpers
    existing_funcs = {}
    if existing_code.strip():
        try:
            tree = ast.parse(existing_code)
            lines = existing_code.splitlines()
            for node in tree.body:
                if isinstance(node, ast.FunctionDef):
                    existing_funcs[node.name] = "\n".join(lines[node.lineno - 1 : node.end_lineno])
        except Exception:
            pass  # Use fallback default code if existing code can't be parsed

    # 1. Generate Imports
    code_lines = ["from typing import TypedDict", "from langgraph.graph import StateGraph, START, END", ""]

    # 2. Generate State Definition
    code_lines.append("# ----------------------------------------------------")
    code_lines.append("# State Definition")
    code_lines.append("# ----------------------------------------------------")
    code_lines.append("class State(TypedDict):")
    variables = payload.get("variables", [])
    if variables:
        for var in variables:
            var_name = var["name"]
            py_type = TYPE_MAP_GB_TO_PY.get(var["type"], "str")
            code_lines.append(f"    {var_name}: {py_type}")
    else:
        code_lines.append("    pass")
    code_lines.append("")

    # 3. Generate Helper Functions
    helpers = payload.get("functions", [])
    if helpers:
        code_lines.append("# ----------------------------------------------------")
        code_lines.append("# Helper Functions")
        code_lines.append("# ----------------------------------------------------")
        for helper in helpers:
            helper_name = helper["name"]
            if helper_name in existing_funcs:
                code_lines.append(existing_funcs[helper_name])
            else:
                code_lines.append(helper.get("raw_string") or f"def {helper_name}(val):\n    return val")
            code_lines.append("")

    # 4. Generate Nodes
    code_lines.append("# ----------------------------------------------------")
    code_lines.append("# Nodes")
    code_lines.append("# ----------------------------------------------------")

    nodes = payload.get("nodes", [])
    edges = payload.get("edges", [])

    # Filter nodes to exclude START and END visual elements
    logic_nodes = [n for n in nodes if n["node_type"] in ("STEP", "SWITCH")]

    for node in logic_nodes:
        node_name = node["id"]
        if node_name in existing_funcs:
            # Reuse existing function body/code
            code_lines.append(existing_funcs[node_name])
        else:
            # Generate default skeleton
            if node["node_type"] == "SWITCH":
                slots = node.get("slots", [])
                default_return = f'"{slots[0]["raw_string"]}"' if slots else '"default"'
                code_lines.append(f"def {node_name}(state: State) -> str:\n    return {default_return}")
            else:
                code_lines.append(f"def {node_name}(state: State) -> dict:\n    return {{}}")
        code_lines.append("")

    # 5. Generate Graph Topology
    code_lines.append("# ----------------------------------------------------")
    code_lines.append("# Graph Definition")
    code_lines.append("# ----------------------------------------------------")
    code_lines.append("workflow = StateGraph(State)")
    code_lines.append("")

    # Add nodes
    for node in logic_nodes:
        code_lines.append(f'workflow.add_node("{node["id"]}", {node["id"]})')
    code_lines.append("")

    # Separate edges
    # Find START edges
    start_edges = [e for e in edges if e["source_id"] == "START"]
    for e in start_edges:
        code_lines.append(f'workflow.add_edge(START, "{e["target_id"]}")')

    # Find static non-START / non-conditional edges
    static_edges = [
        e for e in edges if e["source_id"] != "START" and e["source_type"] == "node" and e["target_id"] != "START"
    ]
    for e in static_edges:
        tgt = "END" if e["target_id"] == "END" else f'"{e["target_id"]}"'
        code_lines.append(f'workflow.add_edge("{e["source_id"]}", {tgt})')

    # Resolve conditional edges (branches) from Switch slot connections
    switch_nodes = [n for n in logic_nodes if n["node_type"] == "SWITCH"]
    for switch in switch_nodes:
        node_name = switch["id"]
        # Find all edges originating from this switch node's slots
        switch_slots = {s["id"]: s["raw_string"] for s in switch.get("slots", [])}
        routing_edges = [e for e in edges if e["source_id"] in switch_slots]

        if routing_edges:
            path_map_lines = []
            # Order path map matching the visual slot order
            for slot in switch.get("slots", []):
                slot_edge = next((e for e in routing_edges if e["source_id"] == slot["id"]), None)
                if slot_edge:
                    tgt = "END" if slot_edge["target_id"] == "END" else f'"{slot_edge["target_id"]}"'
                    path_map_lines.append(f'        "{slot["raw_string"]}": {tgt},')

            code_lines.append("workflow.add_conditional_edges(")
            code_lines.append(f'    "{node_name}",')
            code_lines.append(f"    {node_name},")
            code_lines.append("    {")
            code_lines.extend(path_map_lines)
            code_lines.append("    }")
            code_lines.append(")")
            code_lines.append("")

    code_lines.append("app = workflow.compile()")

    generated_code = "\n".join(code_lines)

    # 6. Formatting with Ruff and Black (if available)
    # We can try to use subprocess to format the string
    import subprocess

    try:
        # Run ruff format via stdin
        process = subprocess.Popen(
            ["ruff", "format", "-"], stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True
        )
        stdout, stderr = process.communicate(input=generated_code)
        if process.returncode == 0:
            generated_code = stdout
    except Exception:
        pass  # Fallback to unformatted if ruff isn't globally available or fails

    return generated_code
