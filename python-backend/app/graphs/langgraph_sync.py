import ast
from typing import Any

from app.graphs.schemas import NodeRead

TYPE_MAP_GB_TO_PY = {
    "number": "int",
    "string": "str",
    "boolean": "bool",
}


def _extract_switch_conditions(node: ast.FunctionDef) -> dict[str, str]:
    """Statically extracts conditional router mappings (return_label -> condition) from a function AST."""
    conditions = {}

    def walk(if_node: ast.AST, conds_map: dict[str, str]) -> None:
        match if_node:
            case ast.If(body=body, orelse=orelse, test=test):
                ret_val = None
                for sub in body:
                    match sub:
                        case ast.Return(value=ast.Constant(value=val)):
                            ret_val = val
                if ret_val:
                    conds_map[ret_val] = ast.unparse(test)
                for sub in orelse:
                    walk(sub, conds_map)

    for stmt in node.body:
        walk(stmt, conditions)
    return conditions


def parse_code_to_graph(code: str) -> dict[str, Any]:
    """
    Statically parses a single Python script to extract State variables and function bodies.
    Does NOT dynamically execute the script.
    """
    if not code.strip():
        raise ValueError("Code is empty")

    try:
        tree = ast.parse(code)
    except SyntaxError as e:
        raise ValueError(f"Syntax Error on line {e.lineno}: {e.msg}") from e

    lines = code.splitlines()
    variables = []
    function_sources: dict[str, str] = {}

    for node in tree.body:
        match node:
            # 1. Parse TypedDict State class
            case ast.ClassDef(name="State", body=body):
                for stmt in body:
                    match stmt:
                        case ast.AnnAssign(target=ast.Name(id=var_name), annotation=ann):
                            type_str = ast.unparse(ann)
                            gb_type = "string"
                            if type_str in ("int", "float", "number"):
                                gb_type = "number"
                            elif type_str in ("bool", "boolean"):
                                gb_type = "boolean"
                            elif type_str == "str":
                                gb_type = "string"

                            variables.append(
                                {
                                    "id": var_name,
                                    "name": var_name,
                                    "type": gb_type,
                                    "value": None,
                                }
                            )

            # 2. Extract top-level function source codes
            case ast.FunctionDef(name=name, lineno=lineno, end_lineno=end_lineno):
                func_code = "\n".join(lines[lineno - 1 : end_lineno])
                function_sources[name] = func_code

    return {
        "variables": variables,
        "functions": function_sources,
    }


def generate_graph_code(
    payload: dict[str, Any],
    existing_code: str = "",
    old_nodes: list[NodeRead] | None = None,
) -> str:
    """
    Generates a Python script from a visual graph payload.
    Uses existing_code to preserve helper functions and node function bodies if possible.
    """
    # Map slot IDs to their old labels from the DB to handle slot renames gracefully
    old_slot_labels = {}
    if old_nodes:
        for node in old_nodes:
            for slot in node.slots:
                old_slot_labels[slot.id] = slot.raw_string

    # Parse existing functions to preserve their code bodies/helpers
    existing_funcs = {}
    switch_conditions = {}
    if existing_code.strip():
        try:
            tree = ast.parse(existing_code)
            lines = existing_code.splitlines()
            for node in tree.body:
                if isinstance(node, ast.FunctionDef):
                    existing_funcs[node.name] = "\n".join(lines[node.lineno - 1 : node.end_lineno])

                    # Statically extract conditional router mapping via AST
                    conditions = _extract_switch_conditions(node)
                    if conditions:
                        switch_conditions[node.name] = conditions
        except Exception:
            pass  # Use fallback default code if existing code can't be parsed

    # 1. Generate Imports
    code_lines = [
        "from typing import TypedDict",
        "",
        "from langgraph.graph import END, START, StateGraph",
        "",
    ]

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
        if node["node_type"] == "SWITCH":
            slots = node.get("slots", [])
            conditions = switch_conditions.get(node_name, {})
            code_lines.append(f"def {node_name}(state: State) -> str:")
            if not slots:
                code_lines.append("    # Add output slots in the UI first")
                code_lines.append('    return ""')
            else:
                # If there were no prior conditions, seed first two with a standard example
                has_any_custom_cond = any(cond != "True" for cond in conditions.values())
                for i, slot in enumerate(slots):
                    label = slot["raw_string"] or f"Slot {i + 1}"

                    # Try to retrieve condition using the slot's old label (resolves renames)
                    old_label = old_slot_labels.get(slot["id"])
                    cond = "True"
                    if old_label and old_label in conditions:
                        cond = conditions[old_label]
                    elif label in conditions:
                        cond = conditions[label]

                    # Prefill switch skeletons with state example if no conditions exist
                    if cond == "True" and not has_any_custom_cond and len(slots) >= 2:
                        if i == 0:
                            cond = 'state.get("x", 0) > 0'
                    code_lines.append(f"    {'if' if i == 0 else 'elif'} {cond}:")
                    code_lines.append(f'        return "{label}"')
                code_lines.append('    return ""')
        elif node_name in existing_funcs:
            # Reuse existing function body/code
            code_lines.append(existing_funcs[node_name])
        else:
            # Generate default skeleton
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
    start_edges = [e for e in edges if e["source_id"] == "start"]
    for e in start_edges:
        code_lines.append(f'workflow.add_edge(START, "{e["target_id"]}")')

    # Find static non-START / non-conditional edges
    static_edges = [
        e for e in edges if e["source_id"] != "start" and e["source_type"] == "node" and e["target_id"] != "start"
    ]
    for e in static_edges:
        tgt = "END" if e["target_id"] == "end" else f'"{e["target_id"]}"'
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
                    tgt = "END" if slot_edge["target_id"] == "end" else f'"{slot_edge["target_id"]}"'
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
