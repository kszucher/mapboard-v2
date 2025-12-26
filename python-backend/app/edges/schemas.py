from __future__ import annotations

import uuid

from pydantic import BaseModel

from app.schemas import OrmModel


class EdgeCreate(BaseModel):
    graph_id: uuid.UUID
    from_node_id: uuid.UUID
    to_node_id: uuid.UUID
    handle_index: int


class EdgeRead(EdgeCreate, OrmModel):
    id: uuid.UUID


class DeleteEdge(BaseModel):
    edge_id: uuid.UUID


class DeleteEdgesByHandle(BaseModel):
    from_node_id: uuid.UUID
    deleted_handle_index: int
