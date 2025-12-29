from __future__ import annotations

import uuid

from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app import models
from app.edges.schemas import EdgeCreate


class EdgeRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def list_by_graph(self, graph_id: uuid.UUID) -> list[models.Edge]:
        result = await self.session.execute(select(models.Edge).where(models.Edge.graph_id == graph_id))
        return list(result.scalars().all())

    async def create(self, data: EdgeCreate) -> models.Edge:
        edge = models.Edge(**data.model_dump())
        self.session.add(edge)
        await self.session.flush()
        return edge

    async def delete(self, edge_id: uuid.UUID) -> None:
        await self.session.execute(delete(models.Edge).where(models.Edge.id == edge_id))

    async def delete_by_from_handle(self, from_node_id: uuid.UUID, deleted_handle_index: int) -> None:
        edges = await self.session.execute(select(models.Edge).where(models.Edge.from_node_id == from_node_id))
        for edge in edges.scalars().all():
            if edge.handle_index == deleted_handle_index:
                await self.session.execute(delete(models.Edge).where(models.Edge.id == edge.id))
            elif edge.handle_index > deleted_handle_index:
                await self.session.execute(
                    update(models.Edge)
                    .where(models.Edge.id == edge.id)
                    .values(handle_index=edge.handle_index - 1)
                )
