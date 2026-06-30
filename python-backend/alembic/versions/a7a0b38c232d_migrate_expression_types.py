"""migrate expression types

Revision ID: a7a0b38c232d
Revises: 7534d6f119ba
Create Date: 2026-06-30 10:53:00.000000

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "a7a0b38c232d"
down_revision: str | Sequence[str] | None = "7534d6f119ba"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    # 1. START
    op.execute(
        "UPDATE expressions SET type = 'BASE_OUTPUT' "
        "WHERE type = 'BASE' AND node_id IN (SELECT id FROM nodes WHERE node_type = 'START')"
    )

    # 2. END
    op.execute(
        "UPDATE expressions SET type = 'BASE_INPUT' "
        "WHERE type = 'BASE' AND node_id IN (SELECT id FROM nodes WHERE node_type = 'END')"
    )

    # 3. LOGIC / AGENT
    op.execute(
        "UPDATE expressions SET type = 'BASE_INPUT_OUTPUT' "
        "WHERE type = 'BASE' AND node_id IN (SELECT id FROM nodes WHERE node_type IN ('LOGIC', 'AGENT'))"
    )

    # 4. SWITCH
    op.execute(
        "UPDATE expressions SET type = 'BASE_INPUT' "
        "WHERE type = 'BASE' AND node_id IN (SELECT id FROM nodes WHERE node_type IN ('LOGICAL_SWITCH', 'AGENTIC_SWITCH'))"
    )
    op.execute(
        "UPDATE expressions SET type = 'SUB_OUTPUT' "
        "WHERE type = 'SUB' AND node_id IN (SELECT id FROM nodes WHERE node_type IN ('LOGICAL_SWITCH', 'AGENTIC_SWITCH'))"
    )

    # 5. JOIN
    op.execute(
        "UPDATE expressions SET type = 'BASE_OUTPUT' "
        "WHERE type = 'BASE' AND node_id IN (SELECT id FROM nodes WHERE node_type IN ('LOGICAL_JOIN', 'AGENTIC_JOIN'))"
    )
    op.execute(
        "UPDATE expressions SET type = 'SUB_INPUT' "
        "WHERE type = 'SUB' AND node_id IN (SELECT id FROM nodes WHERE node_type IN ('LOGICAL_JOIN', 'AGENTIC_JOIN'))"
    )


def downgrade() -> None:
    """Downgrade schema."""
    # 1. Restore BASE
    op.execute("UPDATE expressions SET type = 'BASE' WHERE type IN ('BASE_INPUT', 'BASE_OUTPUT', 'BASE_INPUT_OUTPUT')")

    # 2. Restore SUB
    op.execute("UPDATE expressions SET type = 'SUB' WHERE type IN ('SUB_INPUT', 'SUB_OUTPUT', 'SUB_UNCONNECTED')")
