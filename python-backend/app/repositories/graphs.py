from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models


class GraphRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

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

    async def get(self, graph_id: uuid.UUID) -> models.Graph | None:
        return await self.session.get(models.Graph, graph_id)
