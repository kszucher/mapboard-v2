import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

from app.constants import NodeType


class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


class GraphCreate(BaseModel):
    user_id: uuid.UUID
    graph_name: str = Field(min_length=1, max_length=255)


class GraphRead(OrmModel):
    id: uuid.UUID
    name: str
    user_id: uuid.UUID


class SlotRead(BaseModel):
    id: str
    raw_string: str
    selected: bool = False


class NodeRead(BaseModel):
    id: str
    node_type: NodeType
    is_input: bool = False
    is_output: bool = False
    slots: list[SlotRead]
    code: str = ""
    selected: bool = False


class EdgeRead(BaseModel):
    id: uuid.UUID
    source_id: str
    source_type: Literal["node", "slot"]
    target_id: str
    target_type: Literal["node", "slot"]


class VariableRead(BaseModel):
    id: str
    name: str
    type: Literal["boolean", "string", "number"]
    value: Any = None


class FunctionRead(BaseModel):
    id: str
    name: str
    input_variable: str | None = None
    output_variable: str | None = None
    raw_string: str


class GraphFlowRead(BaseModel):
    code: str = ""
    nodes: list[NodeRead]
    edges: list[EdgeRead]
    variables: list[VariableRead] = []
    functions: list[FunctionRead] = []
    can_undo: bool = False
    can_redo: bool = False


class GraphSyncPayload(BaseModel):
    code: str = ""
    nodes: list[NodeRead]
    edges: list[EdgeRead]
    variables: list[VariableRead] = []
    functions: list[FunctionRead] = []


class NodeCreateRequest(BaseModel):
    node_type: NodeType
    connector_id: str | None = None
    direction: Literal["before", "after"] | None = None


class NodeUpdateRequest(BaseModel):
    new_id: str | None = None
    is_input: bool | None = None
    is_output: bool | None = None


class SlotCreateRequest(BaseModel):
    index: int


class SlotUpdateRequest(BaseModel):
    raw_string: str


class SlotMoveRequest(BaseModel):
    direction: Literal["up", "down", "top", "bottom"]


class EdgeCreateRequest(BaseModel):
    source: str
    target: str
    source_handle: str
    target_handle: str
