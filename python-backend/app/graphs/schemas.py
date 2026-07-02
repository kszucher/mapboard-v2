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


class NodeRead(BaseModel):
    id: uuid.UUID
    graph_id: uuid.UUID
    iid: int
    label: str
    is_processing: bool
    node_type: NodeType
    position: dict | None = None


class ExpressionRead(BaseModel):
    id: uuid.UUID
    node_id: uuid.UUID
    graph_id: uuid.UUID
    idx: int
    type: str
    raw_string: str


class EdgeRead(BaseModel):
    id: uuid.UUID
    graph_id: uuid.UUID
    from_expression_id: uuid.UUID
    to_expression_id: uuid.UUID
    from_node_id: uuid.UUID
    to_node_id: uuid.UUID


class GraphFlowRead(BaseModel):
    nodes: list[NodeRead]
    edges: list[EdgeRead]
    expressions: list[ExpressionRead]


class GraphSyncPayload(BaseModel):
    nodes: list[NodeRead]
    edges: list[EdgeRead]
    expressions: list[ExpressionRead]
