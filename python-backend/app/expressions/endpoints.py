import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.ext.asyncio import AsyncSession
from app.db import get_session
from app.expressions import service
from app.expressions.schemas import ExpressionCreate, ExpressionRead, ExpressionUpdate
from app.events import get_broker, GraphEventBroker

router = APIRouter(prefix="/expressions", tags=["expressions"])

@router.post("", response_model=ExpressionRead)
async def create_expression(
    data: ExpressionCreate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    broker: GraphEventBroker = Depends(get_broker)
):
    sender_client_id = request.headers.get("X-Client-ID")
    return await service.create_expression(session, data, broker, sender_client_id)

@router.patch("/{expression_id}", response_model=ExpressionRead)
async def update_expression(
    expression_id: uuid.UUID,
    data: ExpressionUpdate,
    request: Request,
    session: AsyncSession = Depends(get_session),
    broker: GraphEventBroker = Depends(get_broker)
):
    sender_client_id = request.headers.get("X-Client-ID")
    expr = await service.update_expression(session, expression_id, data, broker, sender_client_id)
    if not expr:
        raise HTTPException(status_code=404, detail="Expression not found")
    return expr

@router.delete("/{expression_id}")
async def delete_expression(
    expression_id: uuid.UUID,
    request: Request,
    session: AsyncSession = Depends(get_session),
    broker: GraphEventBroker = Depends(get_broker)
):
    sender_client_id = request.headers.get("X-Client-ID")
    await service.delete_expression(session, expression_id, broker, sender_client_id)
    return {"status": "ok"}
