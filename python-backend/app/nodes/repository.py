from __future__ import annotations

import uuid
from typing import Any

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app import models
from app.nodes.schemas import NodeCreate


class NodeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_by_graph(self, graph_id: uuid.UUID) -> list[models.Node]:
        result = await self.session.execute(
            select(models.Node)
            .where(models.Node.graph_id == graph_id)
            .options(selectinload(models.Node.expressions))
        )
        return list(result.scalars().all())

    async def create(self, data: NodeCreate) -> models.Node:
        node = models.Node(**data.model_dump(exclude={"expressions"}))
        self.session.add(node)
        await self.session.flush()
        return node

    async def delete(self, node_id: uuid.UUID) -> None:
        await self.session.execute(delete(models.Node).where(models.Node.id == node_id))

    async def get(self, node_id: uuid.UUID) -> models.Node | None:
        result = await self.session.execute(
            select(models.Node)
            .where(models.Node.id == node_id)
            .options(selectinload(models.Node.expressions))
        )
        return result.scalars().first()
