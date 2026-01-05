from __future__ import annotations

import uuid
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.edges.schemas import EdgeCreate
from app.repository import BaseRepository

class EdgeRepository(BaseRepository[models.Edge, EdgeCreate, EdgeCreate]):
    def __init__(self, session: AsyncSession):
        super().__init__(models.Edge, session)

    async def list_by_graph(self, graph_id: uuid.UUID) -> list[models.Edge]:
        result = await self.session.execute(
            select(models.Edge).where(models.Edge.graph_id == graph_id)
        )
        return list(result.scalars().all())

    async def delete_by_node(self, node_id: uuid.UUID) -> None:
        await self.session.execute(
            delete(models.Edge).where(
                (models.Edge.from_node_id == node_id) | (models.Edge.to_node_id == node_id)
            )
        )
        await self.session.flush()
