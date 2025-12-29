from __future__ import annotations

import uuid
from typing import Any

from pydantic import BaseModel

from app.schemas import Color, NodeType, OrmModel


from app.expressions.schemas import ExpressionRead, ExpressionCreate


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
    pass


class UpdateNodeOffset(BaseModel):
    offset_x: int
    offset_y: int


class UpdateNodeDimensions(BaseModel):
    width: int
    height: int



class NodeRead(NodeBase, OrmModel):
    id: uuid.UUID
    expressions: list[ExpressionRead] = []


class DeleteNode(BaseModel):
    node_id: uuid.UUID
