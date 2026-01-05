from __future__ import annotations

import uuid
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.repository import BaseRepository
from pydantic import BaseModel

class GraphCreate(BaseModel):
    user_id: uuid.UUID
    name: str

class GraphRepository(BaseRepository[models.Graph, GraphCreate, GraphCreate]):
    def __init__(self, session: AsyncSession):
        super().__init__(models.Graph, session)

    async def create(self, user_id: uuid.UUID, name: str) -> models.Graph:
        graph = models.Graph(user_id=user_id, name=name)
        self.session.add(graph)
        await self.session.flush()
        return graph

    async def list_by_user(self, user_id: uuid.UUID) -> list[models.Graph]:
        result = await self.session.execute(
            select(models.Graph).where(models.Graph.user_id == user_id).order_by(models.Graph.id.desc())
        )
        return list(result.scalars().all())
