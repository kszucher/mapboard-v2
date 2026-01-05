import uuid
from typing import Any
from fastapi import APIRouter, Depends, HTTPException
from app.db import get_uow
from app.expressions import service
from app.expressions.schemas import ExpressionCreate, ExpressionRead, ExpressionUpdate

router = APIRouter(prefix="/expressions", tags=["expressions"])

@router.post("", response_model=ExpressionRead)
async def create_expression(
    data: ExpressionCreate,
    uow: Any = Depends(get_uow)
):
    expr = await service.create_expression(uow, data)
    await uow.commit()
    return expr

@router.patch("/{expression_id}", response_model=ExpressionRead)
async def update_expression(
    expression_id: uuid.UUID,
    data: ExpressionUpdate,
    uow: Any = Depends(get_uow)
):
    expr = await service.update_expression(uow, expression_id, data)
    if not expr:
        await uow.rollback()
        raise HTTPException(status_code=404, detail="Expression not found")
    await uow.commit()
    return expr

@router.delete("/{expression_id}")
async def delete_expression(
    expression_id: uuid.UUID,
    uow: Any = Depends(get_uow)
):
    await service.delete_expression(uow, expression_id)
    await uow.commit()
    return {"status": "ok"}

@router.get("/graph/{graph_id}", response_model=list[ExpressionRead])
async def get_expressions_by_graph(
    graph_id: uuid.UUID,
    uow: Any = Depends(get_uow)
):
    exprs = await service.list_expressions_by_graph(uow, graph_id)
    return exprs
