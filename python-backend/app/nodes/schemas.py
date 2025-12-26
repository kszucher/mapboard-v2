from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel

from app.schemas import Color, NodeType, OrmModel


class ExpressionBase(BaseModel):
    idx: int
    raw_string: str


class ExpressionCreate(ExpressionBase):
    pass


class ExpressionRead(ExpressionBase, OrmModel):
    id: uuid.UUID


class NodeBase(BaseModel):
    graph_id: uuid.UUID
    iid: int
    width: int
    height: int
    offset_x: int
    offset_y: int
    color: Color
    label: str
    is_processing: bool
    node_type: NodeType


class NodeCreate(NodeBase):
    expressions: list[ExpressionCreate] = []


class NodeUpdate(BaseModel):
    node_id: uuid.UUID
    patch: dict[str, Any]


class NodeRead(NodeBase, OrmModel):
    id: uuid.UUID
    expressions: list[ExpressionRead] = []


class DeleteNode(BaseModel):
    node_id: uuid.UUID
