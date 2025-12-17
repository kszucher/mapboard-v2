from __future__ import annotations

import asyncio
import uuid
from collections import defaultdict
from typing import DefaultDict

from fastapi import WebSocket

from app.schemas import GraphEvent


class GraphEventBroker:
    def __init__(self) -> None:
        self._subscribers: DefaultDict[uuid.UUID, set[WebSocket]] = defaultdict(set)
        self._lock = asyncio.Lock()

    async def subscribe(self, graph_id: uuid.UUID, websocket: WebSocket) -> None:
        async with self._lock:
            self._subscribers[graph_id].add(websocket)

    async def unsubscribe(self, graph_id: uuid.UUID, websocket: WebSocket) -> None:
        async with self._lock:
            self._subscribers[graph_id].discard(websocket)
            if not self._subscribers[graph_id]:
                self._subscribers.pop(graph_id, None)

    async def broadcast(self, event: GraphEvent) -> None:
        async with self._lock:
            listeners = list(self._subscribers.get(event.graph_id, set()))

        if not listeners:
            return

        payload = event.model_dump()
        for ws in listeners:
            try:
                await ws.send_json(payload)
            except Exception:
                # Drop broken sockets silently
                await self.unsubscribe(event.graph_id, ws)


broker = GraphEventBroker()

