from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app import models


class NodeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_by_graph(self, graph_id: uuid.UUID) -> list[models.Node]:
        result = await self.session.execute(select(models.Node).where(models.Node.graph_id == graph_id))
        return list(result.scalars().all())

    async def create(self, data: dict[str, Any]) -> models.Node:
        node = models.Node(**data)
        self.session.add(node)
        await self.session.flush()
        return node

    async def update(self, node_id: uuid.UUID, patch: dict[str, Any]) -> None:
        await self.session.execute(update(models.Node).where(models.Node.id == node_id).values(**patch))

    async def delete(self, node_id: uuid.UUID) -> None:
        await self.session.execute(delete(models.Node).where(models.Node.id == node_id))

    async def get(self, node_id: uuid.UUID) -> models.Node | None:
        return await self.session.get(models.Node, node_id)

