from __future__ import annotations

import uuid
from pydantic import BaseModel
from app.schemas import OrmModel

class ExpressionBase(BaseModel):
    idx: int
    raw_string: str

class ExpressionCreate(ExpressionBase):
    node_id: uuid.UUID

class ExpressionUpdate(BaseModel):
    raw_string: str | None = None
    idx: int | None = None

class ExpressionRead(ExpressionBase, OrmModel):
    id: uuid.UUID
    node_id: uuid.UUID
