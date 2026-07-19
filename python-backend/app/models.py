from __future__ import annotations

import uuid
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class User(Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    color_mode: Mapped[str] = mapped_column(String(16), nullable=False, default="DARK")
    selected_graph_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True), nullable=True)

    graphs: Mapped[list[Graph]] = relationship("Graph", back_populates="user", cascade="all, delete-orphan")


class Graph(Base):
    __tablename__ = "graphs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )

    user: Mapped[User] = relationship("User", back_populates="graphs")
    flow_json: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    current_history_sequence: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    history: Mapped[list[GraphHistory]] = relationship(
        "GraphHistory", back_populates="graph", cascade="all, delete-orphan"
    )


class GraphHistory(Base):
    __tablename__ = "graph_history"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    graph_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False
    )
    flow_json: Mapped[dict] = mapped_column(JSON, nullable=False)
    sequence_number: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    graph: Mapped[Graph] = relationship("Graph", back_populates="history")
