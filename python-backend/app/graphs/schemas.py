import uuid

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


class ExpressionRead(BaseModel):
    id: uuid.UUID
    is_input: bool = False
    is_output: bool = False
    raw_string: str


class NodeRead(BaseModel):
    id: uuid.UUID
    node_type: NodeType
    expressions: list[ExpressionRead]


class EdgeRead(BaseModel):
    id: uuid.UUID
    from_expression_id: uuid.UUID
    to_expression_id: uuid.UUID


class GraphFlowRead(BaseModel):
    nodes: list[NodeRead]
    edges: list[EdgeRead]


class GraphSyncPayload(BaseModel):
    nodes: list[NodeRead]
    edges: list[EdgeRead]
