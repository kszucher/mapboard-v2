"""remove_function_id_from_flow_json

Revision ID: 127baf24a53c
Revises: 3bb36eb87dbf
Create Date: 2026-07-11 13:54:37.004871

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '127baf24a53c'
down_revision: Union[str, Sequence[str], None] = '3bb36eb87dbf'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


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
                if "function_id" in slot:
                    del slot["function_id"]

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
                slot["function_id"] = None

        connection.execute(
            sa.text("UPDATE graphs SET flow_json = :flow_json WHERE id = :graph_id"),
            {"flow_json": json.dumps(flow), "graph_id": graph_id},
        )
