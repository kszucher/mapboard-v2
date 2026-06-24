from __future__ import annotations

import uuid

from pydantic import BaseModel

from app.schemas import Color, NodeType, OrmModel


class NodeBase(BaseModel):
    graph_id: uuid.UUID
    iid: int
    color: Color
    label: str
    is_processing: bool
    node_type: NodeType


class NodeCreate(NodeBase):
    pass


class NodeRead(NodeBase, OrmModel):
    id: uuid.UUID


class DeleteNode(BaseModel):
    node_id: uuid.UUID
