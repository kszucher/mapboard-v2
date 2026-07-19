from __future__ import annotations

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from app.users.repository import UserRepository


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
    graph_id = await repo.get_active_graph_id(user_id)
    if graph_id:
        from app.graphs.repository import GraphHistoryRepository, GraphRepository

        graph_repo = GraphRepository(session)
        history_repo = GraphHistoryRepository(session)
        graph = await graph_repo.get(graph_id)
        if graph:
            flow_data = graph.flow_json or {}
            await history_repo.clear_by_graph(graph_id)
            graph.current_history_sequence = 0
            await history_repo.save_snapshot(graph_id, flow_data, 0)
            await session.commit()
    return graph_id


async def set_active_graph(session: AsyncSession, user_id: uuid.UUID, graph_id: uuid.UUID) -> None:
    repo = UserRepository(session)
    await repo.set_active_graph(user_id, graph_id)

    from app.graphs.repository import GraphHistoryRepository, GraphRepository

    graph_repo = GraphRepository(session)
    history_repo = GraphHistoryRepository(session)
    graph = await graph_repo.get(graph_id)
    if graph:
        flow_data = graph.flow_json or {}
        await history_repo.clear_by_graph(graph_id)
        graph.current_history_sequence = 0
        await history_repo.save_snapshot(graph_id, flow_data, 0)

    await session.commit()
