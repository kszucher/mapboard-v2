from __future__ import annotations

import uuid
from sqlalchemy import select, update, join
from sqlalchemy.ext.asyncio import AsyncSession
from app import models
from app.expressions.schemas import ExpressionCreate, ExpressionUpdate
from app.repository import BaseRepository

class ExpressionRepository(BaseRepository[models.Expression, ExpressionCreate, ExpressionUpdate]):
    def __init__(self, session: AsyncSession):
        super().__init__(models.Expression, session)

    async def list_by_node(self, node_id: uuid.UUID) -> list[models.Expression]:
        result = await self.session.execute(
            select(models.Expression)
            .where(models.Expression.node_id == node_id)
            .order_by(models.Expression.type, models.Expression.idx)
        )
        return list(result.scalars().all())

    async def swap_indices(self, expr1: models.Expression, expr2: models.Expression) -> None:
        temp = expr1.idx
        expr1.idx = expr2.idx
        expr2.idx = temp
        await self.session.flush()

    async def shift_indices_after_deletion(self, node_id: uuid.UUID, deleted_idx: int) -> list[models.Expression]:
        stmt = (
            update(models.Expression)
            .where(models.Expression.node_id == node_id)
            .where(models.Expression.type == "SUB")
            .where(models.Expression.idx > deleted_idx)
            .values(idx=models.Expression.idx - 1)
            .returning(models.Expression)
        )
        result = await self.session.execute(stmt)
        await self.session.flush()
        return list(result.scalars().all())

    async def list_by_graph(self, graph_id: uuid.UUID) -> list[models.Expression]:
        result = await self.session.execute(
            select(models.Expression)
            .join(models.Node)
            .where(models.Node.graph_id == graph_id)
            .order_by(models.Expression.type, models.Expression.idx)
        )
        return list(result.scalars().all())
