"""denormalize_flow_json

Revision ID: 4943d76deb2d
Revises: 3f6fccf4a6fe
Create Date: 2026-07-09 10:28:17.892953

"""

import json
from collections import defaultdict
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4943d76deb2d"
down_revision: str | Sequence[str] | None = "3f6fccf4a6fe"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()
    graphs = connection.execute(sa.text("SELECT id, flow_json FROM graphs")).fetchall()

    for graph_id, flow_json_raw in graphs:
        if not flow_json_raw:
            continue

        if isinstance(flow_json_raw, str):
            flow = json.loads(flow_json_raw)
        else:
            flow = flow_json_raw

        # If it's already migrated (no "expressions" key at the top level), skip it.
        if "expressions" not in flow:
            continue

        expressions = flow.get("expressions", [])
        nodes = flow.get("nodes", [])
        edges = flow.get("edges", [])

        # Group expressions by node_id
        exprs_by_node = defaultdict(list)
        for e in expressions:
            node_id = e.get("node_id")
            if node_id:
                exprs_by_node[node_id].append(e)

        # Sort each node's expressions by idx
        for node_id in exprs_by_node:
            exprs_by_node[node_id].sort(key=lambda x: x.get("idx", 0))

        # Build clean nested nodes list
        new_nodes = []
        for n in nodes:
            node_id = n.get("id")
            node_exprs = exprs_by_node.get(node_id, [])

            cleaned_exprs = []
            for e in node_exprs:
                cleaned_exprs.append(
                    {
                        "id": e.get("id"),
                        "type": e.get("type"),
                        "is_input": e.get("is_input", False),
                        "is_output": e.get("is_output", False),
                        "raw_string": e.get("raw_string", ""),
                    }
                )

            new_nodes.append(
                {
                    "id": node_id,
                    "iid": n.get("iid"),
                    "node_type": n.get("node_type"),
                    "expressions": cleaned_exprs,
                }
            )

        # Build clean edges list (removing redundant graph_id, from_node_id, to_node_id)
        new_edges = []
        for e in edges:
            new_edges.append(
                {
                    "id": e.get("id"),
                    "from_expression_id": e.get("from_expression_id"),
                    "to_expression_id": e.get("to_expression_id"),
                }
            )

        new_flow = {
            "nodes": new_nodes,
            "edges": new_edges,
        }

        # Save back to database
        connection.execute(
            sa.text("UPDATE graphs SET flow_json = :flow_json WHERE id = :graph_id"),
            {"flow_json": json.dumps(new_flow), "graph_id": graph_id},
        )


def downgrade() -> None:
    """Downgrade schema."""
    pass
