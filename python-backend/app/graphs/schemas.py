from __future__ import annotations

import uuid

from pydantic import BaseModel, Field

from app.edges.schemas import EdgeRead
from app.expressions.schemas import ExpressionRead
from app.nodes.schemas import NodeRead
from app.schemas import OrmModel


class GraphCreate(BaseModel):
    user_id: uuid.UUID
    graph_name: str = Field(min_length=1, max_length=255)


class GraphRead(OrmModel):
    id: uuid.UUID
    name: str
    user_id: uuid.UUID


class GraphFlowRead(BaseModel):
    nodes: list[NodeRead]
    edges: list[EdgeRead]
    expressions: list[ExpressionRead]


class GraphSyncPayload(BaseModel):
    nodes: list[NodeRead]
    edges: list[EdgeRead]
    expressions: list[ExpressionRead]
