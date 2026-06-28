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
    LOGIC = "LOGIC"
    AGENT = "AGENT"
    LOGICAL_SWITCH = "LOGICAL_SWITCH"
    AGENTIC_SWITCH = "AGENTIC_SWITCH"
    JOIN = "JOIN"


class ExpressionType(str, Enum):
    BASE = "BASE"
    SUB = "SUB"
