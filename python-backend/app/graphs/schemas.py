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
    id: uuid.UUID
    is_input: bool = False
    is_output: bool = False
    raw_string: str
    function_id: uuid.UUID | None = None
    indent: int = 0


class NodeRead(BaseModel):
    id: uuid.UUID
    node_type: NodeType
    slots: list[SlotRead]


class EdgeRead(BaseModel):
    id: uuid.UUID
    from_slot_id: uuid.UUID
    to_slot_id: uuid.UUID


class VariableRead(BaseModel):
    id: uuid.UUID
    name: str
    type: Literal["boolean", "string", "number"]
    value: Any = None


class FunctionRead(BaseModel):
    id: uuid.UUID
    name: str
    input_variable: uuid.UUID | None = None
    output_variable: uuid.UUID | None = None
    raw_string: str


class GraphFlowRead(BaseModel):
    nodes: list[NodeRead]
    edges: list[EdgeRead]
    variables: list[VariableRead] = []
    functions: list[FunctionRead] = []


class GraphSyncPayload(BaseModel):
    nodes: list[NodeRead]
    edges: list[EdgeRead]
    variables: list[VariableRead] = []
    functions: list[FunctionRead] = []
