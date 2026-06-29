"""expression_to_expression

Revision ID: 802dcdd110ae
Revises: cfebe1f0cace
Create Date: 2026-06-29 12:49:48.444668

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "802dcdd110ae"
down_revision: str | Sequence[str] | None = "cfebe1f0cace"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    connection = op.get_bind()

    # 1. Create BASE expressions for existing START nodes
    start_nodes = connection.execute(sa.text("SELECT id FROM nodes WHERE node_type = 'START'")).fetchall()
    for node in start_nodes:
        node_id = node[0]
        exists = connection.execute(
            sa.text("SELECT 1 FROM expressions WHERE node_id = :node_id AND type = 'BASE'"), {"node_id": node_id}
        ).scalar()
        if not exists:
            import uuid

            expr_id = uuid.uuid4()
            connection.execute(
                sa.text(
                    "INSERT INTO expressions (id, node_id, idx, type, raw_string) VALUES (:id, :node_id, 0, 'BASE', '')"
                ),
                {"id": expr_id, "node_id": node_id},
            )

    # 2. Build a lookup map of node_id -> BASE expression_id
    base_exprs = connection.execute(sa.text("SELECT id, node_id FROM expressions WHERE type = 'BASE'")).fetchall()
    base_expr_map = {node_id: expr_id for expr_id, node_id in base_exprs}

    # 3. Migrate edges' from_expression_id (if NULL, point to base expression of from_node_id)
    edges_to_update_from = connection.execute(
        sa.text("SELECT id, from_node_id FROM edges WHERE from_expression_id IS NULL")
    ).fetchall()
    for edge_id, from_node_id in edges_to_update_from:
        base_expr_id = base_expr_map.get(from_node_id)
        if base_expr_id:
            connection.execute(
                sa.text("UPDATE edges SET from_expression_id = :from_expr_id WHERE id = :edge_id"),
                {"from_expr_id": base_expr_id, "edge_id": edge_id},
            )

    # 4. Migrate edges' to_expression_id (if NULL, point to base expression of to_node_id)
    edges_to_update_to = connection.execute(
        sa.text("SELECT id, to_node_id FROM edges WHERE to_expression_id IS NULL")
    ).fetchall()
    for edge_id, to_node_id in edges_to_update_to:
        base_expr_id = base_expr_map.get(to_node_id)
        if base_expr_id:
            connection.execute(
                sa.text("UPDATE edges SET to_expression_id = :to_expr_id WHERE id = :edge_id"),
                {"to_expr_id": base_expr_id, "edge_id": edge_id},
            )

    # 5. Clean up any invalid edges that couldn't be resolved
    connection.execute(sa.text("DELETE FROM edges WHERE from_expression_id IS NULL OR to_expression_id IS NULL"))

    # 6. Alter the schema: drop columns and make expression fields non-nullable
    with op.batch_alter_table("edges") as batch_op:
        batch_op.drop_column("from_node_id")
        batch_op.drop_column("to_node_id")
        batch_op.drop_column("handle_index")
        batch_op.alter_column("from_expression_id", nullable=False)
        batch_op.alter_column("to_expression_id", nullable=False)


def downgrade() -> None:
    """Downgrade schema."""
    # Since we dropped foreign key constraints and columns, we'll restore columns as nullable
    with op.batch_alter_table("edges") as batch_op:
        batch_op.add_column(sa.Column("from_node_id", sa.UUID(), nullable=True))
        batch_op.add_column(sa.Column("to_node_id", sa.UUID(), nullable=True))
        batch_op.add_column(sa.Column("handle_index", sa.Integer(), nullable=False, server_default="0"))
        batch_op.alter_column("from_expression_id", nullable=True)
        batch_op.alter_column("to_expression_id", nullable=True)

    # Populate the node columns back based on expressions
    connection = op.get_bind()
    connection.execute(
        sa.text(
            "UPDATE edges SET "
            "from_node_id = (SELECT node_id FROM expressions WHERE expressions.id = edges.from_expression_id), "
            "to_node_id = (SELECT node_id FROM expressions WHERE expressions.id = edges.to_expression_id)"
        )
    )

    # Make node columns non-nullable again
    with op.batch_alter_table("edges") as batch_op:
        batch_op.alter_column("from_node_id", nullable=False)
        batch_op.alter_column("to_node_id", nullable=False)
