"""Expressions table + drop legacy node_type_* fields

Revision ID: 20251221_2107
Revises: 
Create Date: 2025-12-21

"""

from __future__ import annotations

import uuid
from typing import Any

from alembic import op
import sqlalchemy as sa


revision = "20251221_2107"
down_revision = None
branch_labels = None
depends_on = None


def _as_list(value: Any) -> list[str]:
    if isinstance(value, list):
        return [str(v) for v in value]
    return []


def upgrade() -> None:
    bind = op.get_bind()

    op.execute(
        """
        CREATE TABLE IF NOT EXISTS expressions (
            id UUID PRIMARY KEY,
            node_id UUID NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
            idx INTEGER NOT NULL,
            raw_string TEXT NOT NULL
        )
        """
    )
    op.execute("CREATE INDEX IF NOT EXISTS ix_expressions_node_id ON expressions(node_id)")
    op.execute("CREATE UNIQUE INDEX IF NOT EXISTS ux_expressions_node_idx ON expressions(node_id, idx)")

    expressions = sa.table(
        "expressions",
        sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("node_id", sa.dialects.postgresql.UUID(as_uuid=True)),
        sa.column("idx", sa.Integer()),
        sa.column("raw_string", sa.Text()),
    )

    legacy_cols = {
        "node_type_logic_input",
        "node_type_agent_input",
        "node_type_logical_switch_input",
        "node_type_agentic_switch_input",
    }

    existing_cols = {
        r[0]
        for r in bind.execute(
            sa.text(
                "SELECT column_name FROM information_schema.columns WHERE table_name='nodes' AND table_schema=current_schema()"
            )
        ).fetchall()
    }

    can_backfill = legacy_cols.issubset(existing_cols) and "node_type" in existing_cols and "id" in existing_cols

    if can_backfill:
        nodes = sa.table(
            "nodes",
            sa.column("id", sa.dialects.postgresql.UUID(as_uuid=True)),
            sa.column("node_type", sa.String()),
            sa.column("node_type_logic_input", sa.JSON()),
            sa.column("node_type_agent_input", sa.JSON()),
            sa.column("node_type_logical_switch_input", sa.JSON()),
            sa.column("node_type_agentic_switch_input", sa.JSON()),
        )

        rows = bind.execute(
            sa.select(
                nodes.c.id,
                nodes.c.node_type,
                nodes.c.node_type_logic_input,
                nodes.c.node_type_agent_input,
                nodes.c.node_type_logical_switch_input,
                nodes.c.node_type_agentic_switch_input,
            )
        ).fetchall()

        inserts: list[dict[str, Any]] = []

        for node_id, node_type, logic_input, agent_input, logical_switch_input, agentic_switch_input in rows:
            exprs: list[str] = []

            if node_type == "START":
                exprs = []
            elif node_type == "LOGIC":
                payload = logic_input or {}
                logical_assignments = _as_list(payload.get("logicalAssignments"))
                exprs = [logical_assignments[0] if logical_assignments else ""]
            elif node_type == "AGENT":
                payload = agent_input or {}
                agentic_assignments = _as_list(payload.get("agenticAssignments"))
                exprs = [agentic_assignments[0] if agentic_assignments else ""]
            elif node_type == "LOGICAL_SWITCH":
                payload = logical_switch_input or {}
                exprs = _as_list(payload.get("logicalExpressions"))
            elif node_type == "AGENTIC_SWITCH":
                payload = agentic_switch_input or {}
                exprs = _as_list(payload.get("agenticExpressions"))
            else:
                exprs = []

            for idx, raw in enumerate(exprs):
                inserts.append({"id": uuid.uuid4(), "node_id": node_id, "idx": idx, "raw_string": str(raw)})

        if inserts:
            # Only insert expressions that don't already exist
            stmt = sa.text("""
            INSERT INTO expressions (id, node_id, idx, raw_string)
            VALUES (:id, :node_id, :idx, :raw_string)
            ON CONFLICT (node_id, idx) DO NOTHING
            """)
            for insert in inserts:
                bind.execute(stmt, insert)

    op.execute("ALTER TABLE nodes DROP COLUMN IF EXISTS node_type_start")
    op.execute("ALTER TABLE nodes DROP COLUMN IF EXISTS node_type_logic_input")
    op.execute("ALTER TABLE nodes DROP COLUMN IF EXISTS node_type_agent_input")
    op.execute("ALTER TABLE nodes DROP COLUMN IF EXISTS node_type_logical_switch_input")
    op.execute("ALTER TABLE nodes DROP COLUMN IF EXISTS node_type_agentic_switch_input")
    op.execute("ALTER TABLE nodes DROP COLUMN IF EXISTS num_handles")


def downgrade() -> None:
    op.add_column("nodes", sa.Column("num_handles", sa.Integer(), nullable=False, server_default="1"))
    op.add_column("nodes", sa.Column("node_type_start", sa.JSON(), nullable=True))
    op.add_column("nodes", sa.Column("node_type_logic_input", sa.JSON(), nullable=True))
    op.add_column("nodes", sa.Column("node_type_agent_input", sa.JSON(), nullable=True))
    op.add_column("nodes", sa.Column("node_type_logical_switch_input", sa.JSON(), nullable=True))
    op.add_column("nodes", sa.Column("node_type_agentic_switch_input", sa.JSON(), nullable=True))

    op.execute("DROP TABLE IF EXISTS expressions")
