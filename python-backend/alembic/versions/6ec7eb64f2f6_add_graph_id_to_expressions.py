"""add_graph_id_to_expressions

Revision ID: 6ec7eb64f2f6
Revises: a7a0b38c232d
Create Date: 2026-07-01 16:36:41.121695

"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "6ec7eb64f2f6"
down_revision: str | Sequence[str] | None = "a7a0b38c232d"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.add_column("expressions", sa.Column("graph_id", sa.UUID(), nullable=True))
    op.execute("UPDATE expressions SET graph_id = nodes.graph_id FROM nodes WHERE expressions.node_id = nodes.id")
    op.alter_column("expressions", "graph_id", nullable=False)
    op.create_foreign_key(
        "fk_expressions_graph_id_graphs",
        "expressions",
        "graphs",
        ["graph_id"],
        ["id"],
        ondelete="CASCADE",
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_constraint("fk_expressions_graph_id_graphs", "expressions", type_="foreignkey")
    op.drop_column("expressions", "graph_id")
