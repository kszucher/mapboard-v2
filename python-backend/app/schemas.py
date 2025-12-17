from __future__ import annotations

import uuid
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict, Field

ColorMode = Literal["DARK", "LIGHT"]
Color = Literal[
    "gray",
    "gold",
    "bronze",
    "brown",
    "yellow",
    "amber",
    "orange",
    "tomato",
    "red",
    "ruby",
    "crimson",
    "pink",
    "plum",
    "purple",
    "violet",
    "iris",
    "indigo",
    "blue",
    "cyan",
    "teal",
    "jade",
    "green",
    "grass",
    "lime",
    "mint",
    "sky",
]

NodeType = Literal["START", "LOGIC", "AGENT", "LOGICAL_SWITCH", "AGENTIC_SWITCH"]


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class UserCreate(BaseModel):
    user_name: str = Field(min_length=1, max_length=255)


class UserRead(OrmModel):
    id: uuid.UUID
    name: str
    color_mode: ColorMode
    selected_graph_id: uuid.UUID | None


class GraphCreate(BaseModel):
    user_id: uuid.UUID
    graph_name: str = Field(min_length=1, max_length=255)


class GraphRead(OrmModel):
    id: uuid.UUID
    name: str
    user_id: uuid.UUID


class NodeBase(BaseModel):
    graph_id: uuid.UUID
    iid: int
    width: int
    height: int
    offset_x: int
    offset_y: int
    color: Color
    label: str
    num_handles: int
    is_processing: bool
    node_type: NodeType
    node_type_start: Optional[dict[str, Any]] = None
    node_type_logic_input: Optional[dict[str, Any]] = None
    node_type_agent_input: Optional[dict[str, Any]] = None
    node_type_logical_switch_input: Optional[dict[str, Any]] = None
    node_type_agentic_switch_input: Optional[dict[str, Any]] = None


class NodeCreate(NodeBase):
    pass


class NodeUpdate(BaseModel):
    node_id: uuid.UUID
    patch: dict[str, Any]


class NodeRead(NodeBase, OrmModel):
    id: uuid.UUID


class EdgeCreate(BaseModel):
    graph_id: uuid.UUID
    from_node_id: uuid.UUID
    to_node_id: uuid.UUID
    handle_index: int


class EdgeRead(EdgeCreate, OrmModel):
    id: uuid.UUID


class DeleteNode(BaseModel):
    node_id: uuid.UUID


class DeleteEdge(BaseModel):
    edge_id: uuid.UUID


class DeleteEdgesByHandle(BaseModel):
    from_node_id: uuid.UUID
    deleted_handle_index: int


class SetActiveGraph(BaseModel):
    user_id: uuid.UUID
    graph_id: uuid.UUID


class ActiveGraphResponse(BaseModel):
    graph_id: uuid.UUID | None


class GraphEvent(BaseModel):
    event: Literal[
        "graph_created",
        "graph_updated",
        "node_created",
        "node_updated",
        "node_deleted",
        "edge_created",
        "edge_deleted",
        "edges_updated",
    ]
    graph_id: uuid.UUID
    payload: dict[str, Any]


