from __future__ import annotations

import uuid

from app.services.events import broker
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter(prefix="/ws", tags=["websocket"])


@router.websocket("/graphs/{graph_id}")
async def graph_ws(graph_id: uuid.UUID, websocket: WebSocket) -> None:
    await websocket.accept()
    await broker.subscribe(graph_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await broker.unsubscribe(graph_id, websocket)
    except Exception:
        await broker.unsubscribe(graph_id, websocket)
        await websocket.close()


