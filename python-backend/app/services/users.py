from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.repositories.users import UserRepository


async def get_or_create_user(session: AsyncSession) -> uuid.UUID:
    repo = UserRepository(session)
    user = await repo.get_first()
    if user:
        return user.id
    created = await repo.create(name="User")
    await session.commit()
    return created.id


async def create_user(session: AsyncSession, user_name: str) -> uuid.UUID:
    repo = UserRepository(session)
    user = await repo.create(name=user_name)
    await session.commit()
    return user.id


async def get_active_graph_id(session: AsyncSession, user_id: uuid.UUID) -> uuid.UUID | None:
    repo = UserRepository(session)
    return await repo.get_active_graph_id(user_id)


async def set_active_graph(session: AsyncSession, user_id: uuid.UUID, graph_id: uuid.UUID) -> None:
    repo = UserRepository(session)
    await repo.set_active_graph(user_id, graph_id)
    await session.commit()

