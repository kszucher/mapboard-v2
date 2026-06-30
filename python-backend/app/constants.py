from enum import Enum


class EventName(str, Enum):
    GRAPH_CREATED = "graph_created"
    GRAPH_UPDATED = "graph_updated"
    NODE_CREATED = "node_created"
    NODE_UPDATED = "node_updated"
    NODE_DELETED = "node_deleted"
    EDGE_CREATED = "edge_created"
    EDGE_DELETED = "edge_deleted"
    EDGES_UPDATED = "edges_updated"
    EXPRESSION_CREATED = "expression_created"
    EXPRESSION_UPDATED = "expression_updated"
    EXPRESSION_DELETED = "expression_deleted"


class NodeType(str, Enum):
    START = "START"
    END = "END"
    LOGIC = "LOGIC"
    AGENT = "AGENT"
    LOGICAL_SWITCH = "LOGICAL_SWITCH"
    AGENTIC_SWITCH = "AGENTIC_SWITCH"
    LOGICAL_JOIN = "LOGICAL_JOIN"
    AGENTIC_JOIN = "AGENTIC_JOIN"
    TRANSFORM_AGENT_TO_LOGICAL = "TRANSFORM_AGENT_TO_LOGICAL"
    TRANSFORM_LOGICAL_TO_AGENT = "TRANSFORM_LOGICAL_TO_AGENT"


class ExpressionType(str, Enum):
    BASE_INPUT = "BASE_INPUT"
    SUB_INPUT = "SUB_INPUT"
    SUB_UNCONNECTED = "SUB_UNCONNECTED"
    BASE_OUTPUT = "BASE_OUTPUT"
    SUB_OUTPUT = "SUB_OUTPUT"
    BASE_INPUT_OUTPUT = "BASE_INPUT_OUTPUT"
