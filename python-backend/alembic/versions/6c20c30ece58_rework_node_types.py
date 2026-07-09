"""rework_node_types

Revision ID: 6c20c30ece58
Revises: 8fd3f410ec88
Create Date: 2026-07-09 12:01:01.800467

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '6c20c30ece58'
down_revision: str | Sequence[str] | None = '8fd3f410ec88'
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    import json
    connection = op.get_bind()
    graphs = connection.execute(sa.text("SELECT id, flow_json FROM graphs")).fetchall()

    for graph_id, flow_json_raw in graphs:
        if not flow_json_raw:
            continue

        if isinstance(flow_json_raw, str):
            flow = json.loads(flow_json_raw)
        else:
            flow = flow_json_raw

        nodes = flow.get("nodes", [])
        remaining_nodes = []
        remaining_expr_ids = set()

        for n in nodes:
            node_type = n.get("node_type")
            if node_type == "AGENT":
                continue
            
            # Rename types
            if node_type == "FUNCTION":
                n["node_type"] = "STEP"
            elif node_type == "SWITCH":
                n["node_type"] = "BRANCH"
            elif node_type == "REDUCE":
                n["node_type"] = "MERGE"
            
            remaining_nodes.append(n)
            for expr in n.get("expressions", []):
                if expr.get("id"):
                    remaining_expr_ids.add(expr["id"])

        flow["nodes"] = remaining_nodes

        edges = flow.get("edges", [])
        remaining_edges = []
        for e in edges:
            from_expr = e.get("from_expression_id")
            to_expr = e.get("to_expression_id")
            if from_expr in remaining_expr_ids and to_expr in remaining_expr_ids:
                remaining_edges.append(e)

        flow["edges"] = remaining_edges

        connection.execute(
            sa.text("UPDATE graphs SET flow_json = :flow_json WHERE id = :graph_id"),
            {"flow_json": json.dumps(flow), "graph_id": graph_id},
        )


def downgrade() -> None:
    """Downgrade schema."""
    import json
    connection = op.get_bind()
    graphs = connection.execute(sa.text("SELECT id, flow_json FROM graphs")).fetchall()

    for graph_id, flow_json_raw in graphs:
        if not flow_json_raw:
            continue

        if isinstance(flow_json_raw, str):
            flow = json.loads(flow_json_raw)
        else:
            flow = flow_json_raw

        nodes = flow.get("nodes", [])
        for n in nodes:
            node_type = n.get("node_type")
            if node_type == "STEP":
                n["node_type"] = "FUNCTION"
            elif node_type == "BRANCH":
                n["node_type"] = "SWITCH"
            elif node_type == "MERGE":
                n["node_type"] = "REDUCE"

        connection.execute(
            sa.text("UPDATE graphs SET flow_json = :flow_json WHERE id = :graph_id"),
            {"flow_json": json.dumps(flow), "graph_id": graph_id},
        )
