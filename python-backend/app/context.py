from __future__ import annotations

import uuid
from typing import TYPE_CHECKING, Any

from sqlalchemy.ext.asyncio import AsyncSession

from app.constants import EventName
from app.events import GraphEventBroker

if TYPE_CHECKING:
    from app.edges.repository import EdgeRepository
    from app.expressions.repository import ExpressionRepository
    from app.graphs.repository import GraphRepository
    from app.nodes.repository import NodeRepository
    from app.users.repository import UserRepository


class UnitOfWork:
    def __init__(self, session: AsyncSession, broker: GraphEventBroker, sender_client_id: str | None = None):
        self.session = session
        self.broker = broker
        self.sender_client_id = sender_client_id
        self._events: list[dict[str, Any]] = []

        # Lazy-loaded repositories
        self._nodes: NodeRepository | None = None
        self._edges: EdgeRepository | None = None
        self._expressions: ExpressionRepository | None = None
        self._graphs: GraphRepository | None = None
        self._users: UserRepository | None = None

    @property
    def nodes(self) -> NodeRepository:
        if self._nodes is None:
            from app.nodes.repository import NodeRepository

            self._nodes = NodeRepository(self.session)
        return self._nodes

    @property
    def edges(self) -> EdgeRepository:
        if self._edges is None:
            from app.edges.repository import EdgeRepository

            self._edges = EdgeRepository(self.session)
        return self._edges

    @property
    def expressions(self) -> ExpressionRepository:
        if self._expressions is None:
            from app.expressions.repository import ExpressionRepository

            self._expressions = ExpressionRepository(self.session)
        return self._expressions

    @property
    def graphs(self) -> GraphRepository:
        if self._graphs is None:
            from app.graphs.repository import GraphRepository

            self._graphs = GraphRepository(self.session)
        return self._graphs

    @property
    def users(self) -> UserRepository:
        if self._users is None:
            from app.users.repository import UserRepository

            self._users = UserRepository(self.session)
        return self._users

    def emit(self, event: EventName, graph_id: uuid.UUID, payload: dict[str, Any]):
        """Buffer an event to be broadcasted after commit."""
        self._events.append(
            {"event": event, "graph_id": graph_id, "payload": payload, "sender_client_id": self.sender_client_id}
        )

    async def commit(self):
        """Commit the transaction and broadcast accumulated events."""
        await self.session.commit()
        for event_data in self._events:
            await self.broker.emit(**event_data)
        self._events.clear()

    async def rollback(self):
        """Rollback the transaction and clear events."""
        await self.session.rollback()
        self._events.clear()
