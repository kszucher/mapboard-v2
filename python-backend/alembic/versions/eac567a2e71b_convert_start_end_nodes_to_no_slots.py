"""convert_start_end_nodes_to_no_slots

Revision ID: eac567a2e71b
Revises: 2f02697e6dde
Create Date: 2026-07-11 13:33:03.716811

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = 'eac567a2e71b'
down_revision: str | Sequence[str] | None = '2f02697e6dde'
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
        edges = flow.get("edges", [])

        for node in nodes:
            node_type = node.get("node_type")
            if node_type == "START":
                # Find old slots
                slots = node.get("slots", [])
                if slots:
                    slot_id = slots[0].get("id")
                    # Rewire edges from this slot to the node itself
                    for edge in edges:
                        if edge.get("source_id") == slot_id:
                            edge["source_id"] = node.get("id")
                            edge["source_type"] = "node"
                node["is_input"] = False
                node["is_output"] = True
                node["slots"] = []
            elif node_type == "END":
                slots = node.get("slots", [])
                if slots:
                    slot_id = slots[0].get("id")
                    # Rewire edges to this slot to the node itself
                    for edge in edges:
                        if edge.get("target_id") == slot_id:
                            edge["target_id"] = node.get("id")
                            edge["target_type"] = "node"
                node["is_input"] = True
                node["is_output"] = False
                node["slots"] = []

        connection.execute(
            sa.text("UPDATE graphs SET flow_json = :flow_json WHERE id = :graph_id"),
            {"flow_json": json.dumps(flow), "graph_id": graph_id},
        )


def downgrade() -> None:
    """Downgrade schema."""
    pass
