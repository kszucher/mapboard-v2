"""rename_expression_to_slot

Revision ID: d2e185cb0304
Revises: 6c20c30ece58
Create Date: 2026-07-09 16:04:52.147958

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "d2e185cb0304"
down_revision: str | Sequence[str] | None = "6c20c30ece58"
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
        for n in nodes:
            if "expressions" in n:
                n["slots"] = n.pop("expressions")

        edges = flow.get("edges", [])
        for e in edges:
            if "from_expression_id" in e:
                e["from_slot_id"] = e.pop("from_expression_id")
            if "to_expression_id" in e:
                e["to_slot_id"] = e.pop("to_expression_id")

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
            if "slots" in n:
                n["expressions"] = n.pop("slots")

        edges = flow.get("edges", [])
        for e in edges:
            if "from_slot_id" in e:
                e["from_expression_id"] = e.pop("from_slot_id")
            if "to_slot_id" in e:
                e["to_expression_id"] = e.pop("to_slot_id")

        connection.execute(
            sa.text("UPDATE graphs SET flow_json = :flow_json WHERE id = :graph_id"),
            {"flow_json": json.dumps(flow), "graph_id": graph_id},
        )
