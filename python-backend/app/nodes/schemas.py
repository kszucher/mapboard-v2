from __future__ import annotations

import uuid

from pydantic import BaseModel

from app.constants import NodeType
from app.schemas import OrmModel


class NodeBase(BaseModel):
    graph_id: uuid.UUID
    iid: int
    label: str
    is_processing: bool
    node_type: NodeType


class NodeCreate(NodeBase):
    id: uuid.UUID | None = None


class ConnectedNodeCreate(BaseModel):
    node_type: NodeType
    node_id: uuid.UUID
    base_expression_id: uuid.UUID
    sub_expression_id: uuid.UUID | None = None
    edge_id: uuid.UUID


class NodeRead(NodeBase, OrmModel):
    id: uuid.UUID


class DeleteNode(BaseModel):
    node_id: uuid.UUID
