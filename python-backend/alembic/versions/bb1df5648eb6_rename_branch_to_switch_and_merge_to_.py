"""rename_branch_to_switch_and_merge_to_join

Revision ID: bb1df5648eb6
Revises: d2e185cb0304
Create Date: 2026-07-11 12:57:24.675240

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "bb1df5648eb6"
down_revision: str | Sequence[str] | None = "d2e185cb0304"
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
            node_type = n.get("node_type")
            if node_type == "BRANCH":
                n["node_type"] = "SWITCH"
            elif node_type == "MERGE":
                n["node_type"] = "JOIN"

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
            if node_type == "SWITCH":
                n["node_type"] = "BRANCH"
            elif node_type == "JOIN":
                n["node_type"] = "MERGE"

        connection.execute(
            sa.text("UPDATE graphs SET flow_json = :flow_json WHERE id = :graph_id"),
            {"flow_json": json.dumps(flow), "graph_id": graph_id},
        )
