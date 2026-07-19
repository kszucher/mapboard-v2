"""remove_indent_from_flow_json

Revision ID: 3bb36eb87dbf
Revises: eac567a2e71b
Create Date: 2026-07-11 13:47:45.120346

"""
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = '3bb36eb87dbf'
down_revision: str | Sequence[str] | None = 'eac567a2e71b'
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
        for node in nodes:
            slots = node.get("slots", [])
            for slot in slots:
                if "indent" in slot:
                    del slot["indent"]

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
        for node in nodes:
            slots = node.get("slots", [])
            for slot in slots:
                slot["indent"] = 0

        connection.execute(
            sa.text("UPDATE graphs SET flow_json = :flow_json WHERE id = :graph_id"),
            {"flow_json": json.dumps(flow), "graph_id": graph_id},
        )
