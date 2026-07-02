"""migrate_to_flow_json

Revision ID: 3f6fccf4a6fe
Revises: 6ec7eb64f2f6
Create Date: 2026-07-02 15:34:01.986568

"""

import json
from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "3f6fccf4a6fe"
down_revision: str | Sequence[str] | None = "6ec7eb64f2f6"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. Add nullable flow_json column
    op.add_column("graphs", sa.Column("flow_json", sa.JSON(), nullable=True))

    # 2. Migrate existing data
    bind = op.get_bind()
    graphs = bind.execute(sa.text("SELECT id FROM graphs")).fetchall()
    for graph_row in graphs:
        graph_id = graph_row[0]

        # Fetch nodes
        nodes_res = bind.execute(
            sa.text("SELECT id, graph_id, iid, label, is_processing, node_type FROM nodes WHERE graph_id = :graph_id"),
            {"graph_id": graph_id},
        ).fetchall()
        nodes_list = []
        for n in nodes_res:
            nodes_list.append(
                {
                    "id": str(n[0]),
                    "graph_id": str(n[1]),
                    "iid": n[2],
                    "label": n[3],
                    "is_processing": n[4],
                    "node_type": n[5],
                }
            )

        # Fetch expressions
        exprs_res = bind.execute(
            sa.text("SELECT id, node_id, graph_id, idx, type, raw_string FROM expressions WHERE graph_id = :graph_id"),
            {"graph_id": graph_id},
        ).fetchall()
        exprs_list = []
        for e in exprs_res:
            exprs_list.append(
                {
                    "id": str(e[0]),
                    "node_id": str(e[1]),
                    "graph_id": str(e[2]),
                    "idx": e[3],
                    "type": e[4],
                    "raw_string": e[5],
                }
            )

        # Map expression ID to node ID
        expr_to_node = {str(e[0]): str(e[1]) for e in exprs_res}

        # Fetch edges
        edges_res = bind.execute(
            sa.text("SELECT id, graph_id, from_expression_id, to_expression_id FROM edges WHERE graph_id = :graph_id"),
            {"graph_id": graph_id},
        ).fetchall()
        edges_list = []
        for ed in edges_res:
            from_expr = str(ed[2])
            to_expr = str(ed[3])
            edges_list.append(
                {
                    "id": str(ed[0]),
                    "graph_id": str(ed[1]),
                    "from_expression_id": from_expr,
                    "to_expression_id": to_expr,
                    "from_node_id": expr_to_node.get(from_expr),
                    "to_node_id": expr_to_node.get(to_expr),
                }
            )

        flow_data = {"nodes": nodes_list, "edges": edges_list, "expressions": exprs_list}

        bind.execute(
            sa.text("UPDATE graphs SET flow_json = :flow_json WHERE id = :graph_id"),
            {"flow_json": json.dumps(flow_data), "graph_id": graph_id},
        )

    # Populate any null ones (new graphs or graphs with no nodes/edges) with empty defaults
    bind.execute(
        sa.text('UPDATE graphs SET flow_json = \'{"nodes":[], "edges":[], "expressions":[]}\' WHERE flow_json IS NULL')
    )

    # 3. Set nullable=False and add server default
    op.alter_column("graphs", "flow_json", nullable=False, server_default='{"nodes":[], "edges":[], "expressions":[]}')

    # 4. Drop tables in bottom-up order (edges -> expressions -> nodes)
    op.drop_table("edges")
    op.drop_table("expressions")
    op.drop_table("nodes")


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Recreate tables
    op.create_table(
        "nodes",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("graph_id", sa.UUID(), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("iid", sa.Integer(), nullable=False),
        sa.Column("label", sa.String(255), nullable=False),
        sa.Column("is_processing", sa.Boolean(), nullable=False, default=False),
        sa.Column("node_type", sa.String(32), nullable=False),
    )

    op.create_table(
        "expressions",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("node_id", sa.UUID(), sa.ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False),
        sa.Column("graph_id", sa.UUID(), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idx", sa.Integer(), nullable=False),
        sa.Column("type", sa.String(32), nullable=False),
        sa.Column("raw_string", sa.Text(), nullable=False),
    )

    op.create_table(
        "edges",
        sa.Column("id", sa.UUID(), primary_key=True),
        sa.Column("graph_id", sa.UUID(), sa.ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("from_expression_id", sa.UUID(), sa.ForeignKey("expressions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("to_expression_id", sa.UUID(), sa.ForeignKey("expressions.id", ondelete="CASCADE"), nullable=False),
    )

    # 2. Re-populate tables from flow_json
    bind = op.get_bind()
    graphs = bind.execute(sa.text("SELECT id, flow_json FROM graphs")).fetchall()
    for graph_row in graphs:
        flow_json_raw = graph_row[1]
        if not flow_json_raw:
            continue

        if isinstance(flow_json_raw, str):
            flow_data = json.loads(flow_json_raw)
        else:
            flow_data = flow_json_raw

        nodes = flow_data.get("nodes", [])
        expressions = flow_data.get("expressions", [])
        edges = flow_data.get("edges", [])

        for n in nodes:
            bind.execute(
                sa.text(
                    "INSERT INTO nodes (id, graph_id, iid, label, is_processing, node_type) "
                    "VALUES (:id, :graph_id, :iid, :label, :is_processing, :node_type)"
                ),
                {
                    "id": n["id"],
                    "graph_id": n["graph_id"],
                    "iid": n["iid"],
                    "label": n["label"],
                    "is_processing": n["is_processing"],
                    "node_type": n["node_type"],
                },
            )

        for e in expressions:
            bind.execute(
                sa.text(
                    "INSERT INTO expressions (id, node_id, graph_id, idx, type, raw_string) "
                    "VALUES (:id, :node_id, :graph_id, :idx, :type, :raw_string)"
                ),
                {
                    "id": e["id"],
                    "node_id": e["node_id"],
                    "graph_id": e["graph_id"],
                    "idx": e["idx"],
                    "type": e["type"],
                    "raw_string": e["raw_string"],
                },
            )

        for ed in edges:
            bind.execute(
                sa.text(
                    "INSERT INTO edges (id, graph_id, from_expression_id, to_expression_id) "
                    "VALUES (:id, :graph_id, :from_expression_id, :to_expression_id)"
                ),
                {
                    "id": ed["id"],
                    "graph_id": ed["graph_id"],
                    "from_expression_id": ed["from_expression_id"],
                    "to_expression_id": ed["to_expression_id"],
                },
            )

    # 3. Drop flow_json column
    op.drop_column("graphs", "flow_json")
