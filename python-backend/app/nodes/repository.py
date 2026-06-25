from __future__ import annotations

import uuid

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.nodes.schemas import NodeCreate
from app.repository import BaseRepository


# Use NodeCreate as both Create and Update for now, or just NodeCreate if update not needed here
class NodeRepository(BaseRepository[models.Node, NodeCreate, NodeCreate]):
    def __init__(self, session: AsyncSession):
        super().__init__(models.Node, session)

    async def list_by_graph(self, graph_id: uuid.UUID) -> list[models.Node]:
        result = await self.session.execute(select(models.Node).where(models.Node.graph_id == graph_id))
        return list(result.scalars().all())
