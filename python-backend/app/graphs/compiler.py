from langgraph.graph import StateGraph
from langgraph.pregel import Pregel

from app.graphs.schemas import GraphFlowRead


def compile_flow_with_langgraph(flow: GraphFlowRead) -> Pregel:
    """
    Compiles the graph by executing the synchronized python script.
    """
    code = flow.code
    if not code:
        raise ValueError("No compiled script present in flow data.")

    namespace = {}
    try:
        exec(code, {}, namespace)
    except Exception as e:
        raise ValueError(f"Execution failed: {str(e)}") from e

    # Find compiled Pregel app or StateGraph
    for val in namespace.values():
        if isinstance(val, Pregel):
            return val
        if isinstance(val, StateGraph):
            return val.compile()
    raise ValueError("Could not find compiled 'app' or 'workflow' object in python script.")
