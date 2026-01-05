from __future__ import annotations

import uuid
from sqlalchemy.ext.asyncio import AsyncSession
from app import models
from app.expressions.repository import ExpressionRepository
from app.expressions.schemas import ExpressionCreate, ExpressionUpdate
from app.schemas import GraphEvent
from app.events import GraphEventBroker

def validate_expressions_for_node_type(node_type: str, expressions: list[models.Expression] | list[ExpressionCreate]) -> None:
    if node_type == "START":
        if len(expressions) != 0:
            raise ValueError("START nodes must have 0 expressions")
    elif node_type in {"LOGIC", "AGENT"}:
        if len(expressions) != 1:
            raise ValueError(f"{node_type} nodes must have exactly 1 expression")
    elif node_type in {"LOGICAL_SWITCH", "AGENTIC_SWITCH"}:
        return
    else:
        raise ValueError(f"Unknown node_type: {node_type}")

async def create_expression(
    session: AsyncSession, data: ExpressionCreate, broker: GraphEventBroker, sender_client_id: str | None = None
) -> models.Expression:
    from app.nodes.repository import NodeRepository
    repo = ExpressionRepository(session)
    node_repo = NodeRepository(session)
    
    node = await node_repo.get(data.node_id)
    if not node:
        raise ValueError(f"Node {data.node_id} not found")
        
    if data.idx is None:
        expressions = await repo.list_by_node(data.node_id)
        data.idx = len(expressions)

    expr = await repo.create(data)
    await session.commit()
    
    await broker.broadcast(
        GraphEvent(
            event="expression_created",
            graph_id=node.graph_id,
            payload={"expressionId": str(expr.id), "nodeId": str(node.id), "expression": {"id": str(expr.id), "idx": expr.idx, "raw_string": expr.raw_string}},
            sender_client_id=sender_client_id,
        )
    )
    return expr

async def update_expression(
    session: AsyncSession, expression_id: uuid.UUID, data: ExpressionUpdate, broker: GraphEventBroker, sender_client_id: str | None = None
) -> models.Expression | None:
    from app.nodes.repository import NodeRepository
    repo = ExpressionRepository(session)
    expr = await repo.update(expression_id, data)
    if not expr:
        return None
        
    node_repo = NodeRepository(session)
    node = await node_repo.get(expr.node_id)
    
    await session.commit()
    
    if node:
        await broker.broadcast(
            GraphEvent(
                event="expression_updated",
                graph_id=node.graph_id,
                payload={"expressionId": str(expr.id), "patch": data.model_dump(exclude_unset=True)},
                sender_client_id=sender_client_id,
            )
        )
    return expr

async def delete_expression(
    session: AsyncSession, expression_id: uuid.UUID, broker: GraphEventBroker, sender_client_id: str | None = None
) -> None:
    from app.nodes.repository import NodeRepository
    repo = ExpressionRepository(session)
    expr = await repo.get(expression_id)
    if not expr:
        return
        
    node_repo = NodeRepository(session)
    node = await node_repo.get(expr.node_id)
    if not node:
        return

    deleted_idx = expr.idx

    # Delete the expression
    await repo.delete(expression_id)
    
    # Shift subsequent expressions natively in DB
    expression_updates = await repo.shift_indices_after_deletion(expr.node_id, deleted_idx)

    await session.commit()
    
    # Broadcast deletion
    await broker.broadcast(
        GraphEvent(
            event="expression_deleted",
            graph_id=node.graph_id,
            payload={"expressionId": str(expression_id), "nodeId": str(node.id)},
            sender_client_id=sender_client_id,
        )
    )
    
    # Broadcast updates for shifted indices
    for updated_expr in expression_updates:
        await broker.broadcast(
            GraphEvent(
                event="expression_updated",
                graph_id=node.graph_id,
                payload={"expressionId": str(updated_expr.id), "patch": {"idx": updated_expr.idx}},
                sender_client_id=sender_client_id,
            )
        )


async def create_default_expressions_for_node(
    session: AsyncSession, node: models.Node
) -> None:
    repo = ExpressionRepository(session)
    if node.node_type in {"LOGIC", "AGENT"}:
        await repo.create(ExpressionCreate(node_id=node.id, idx=0, raw_string=""))
