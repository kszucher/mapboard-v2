"""rename_join_to_agentic_join

Revision ID: 4d691f7a1d67
Revises: 802dcdd110ae
Create Date: 2026-06-29 18:56:01.004458

"""

from collections.abc import Sequence

from alembic import op

# revision identifiers, used by Alembic.
revision: str = "4d691f7a1d67"
down_revision: str | Sequence[str] | None = "802dcdd110ae"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Upgrade schema."""
    op.execute("UPDATE nodes SET node_type = 'AGENTIC_JOIN', label = 'Agentic Join' WHERE node_type = 'JOIN'")


def downgrade() -> None:
    """Downgrade schema."""
    op.execute("UPDATE nodes SET node_type = 'JOIN', label = 'Join' WHERE node_type = 'AGENTIC_JOIN'")
