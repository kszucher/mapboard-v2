from __future__ import annotations

import uuid
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from app import models
from app.expressions.schemas import ExpressionCreate, ExpressionUpdate

class ExpressionRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: ExpressionCreate) -> models.Expression:
        expression = models.Expression(**data.model_dump())
        self.session.add(expression)
        await self.session.flush()
        return expression

    async def get(self, expression_id: uuid.UUID) -> models.Expression | None:
        result = await self.session.execute(
            select(models.Expression).where(models.Expression.id == expression_id)
        )
        return result.scalars().first()

    async def list_by_node(self, node_id: uuid.UUID) -> list[models.Expression]:
        result = await self.session.execute(
            select(models.Expression)
            .where(models.Expression.node_id == node_id)
            .order_by(models.Expression.idx)
        )
        return list(result.scalars().all())

    async def update(self, expression_id: uuid.UUID, data: ExpressionUpdate) -> models.Expression | None:
        expression = await self.get(expression_id)
        if not expression:
            return None
        
        update_data = data.model_dump(exclude_unset=True)
        for key, value in update_data.items():
            setattr(expression, key, value)
        
        await self.session.flush()
        return expression

    async def delete(self, expression_id: uuid.UUID) -> None:
        await self.session.execute(
            delete(models.Expression).where(models.Expression.id == expression_id)
        )
