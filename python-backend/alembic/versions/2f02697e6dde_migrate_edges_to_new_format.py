"""migrate_edges_to_new_format

Revision ID: 2f02697e6dde
Revises: bb1df5648eb6
Create Date: 2026-07-11 13:19:37.065470

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2f02697e6dde'
down_revision: Union[str, Sequence[str], None] = 'bb1df5648eb6'
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
            if "is_input" not in node:
                node["is_input"] = False
            if "is_output" not in node:
                node["is_output"] = False

        edges = flow.get("edges", [])
        updated_edges = []
        for edge in edges:
            # Migrate old slot fields if they exist
            from_slot = edge.get("from_slot_id")
            to_slot = edge.get("to_slot_id")
            
            if from_slot is not None:
                edge["source_id"] = from_slot
                edge["source_type"] = "slot"
                edge.pop("from_slot_id", None)
                
            if to_slot is not None:
                edge["target_id"] = to_slot
                edge["target_type"] = "slot"
                edge.pop("to_slot_id", None)
                
            updated_edges.append(edge)
            
        flow["edges"] = updated_edges

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

        edges = flow.get("edges", [])
        updated_edges = []
        for edge in edges:
            source_id = edge.get("source_id")
            target_id = edge.get("target_id")
            
            if source_id is not None:
                edge["from_slot_id"] = source_id
                edge.pop("source_id", None)
                edge.pop("source_type", None)
                
            if target_id is not None:
                edge["to_slot_id"] = target_id
                edge.pop("target_id", None)
                edge.pop("target_type", None)
                
            updated_edges.append(edge)
            
        flow["edges"] = updated_edges

        connection.execute(
            sa.text("UPDATE graphs SET flow_json = :flow_json WHERE id = :graph_id"),
            {"flow_json": json.dumps(flow), "graph_id": graph_id},
        )
