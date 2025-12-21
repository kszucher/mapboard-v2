from __future__ import annotations

import uuid
from sqlalchemy import Boolean, ForeignKey, Integer, String, Text
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

    graphs: Mapped[list["Graph"]] = relationship("Graph", back_populates="user", cascade="all, delete-orphan")


class Graph(Base):
    __tablename__ = "graphs"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    user_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False)

    user: Mapped[User] = relationship("User", back_populates="graphs")
    nodes: Mapped[list["Node"]] = relationship("Node", back_populates="graph", cascade="all, delete-orphan")
    edges: Mapped[list["Edge"]] = relationship("Edge", back_populates="graph", cascade="all, delete-orphan")


class Node(Base):
    __tablename__ = "nodes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    graph_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False)

    iid: Mapped[int] = mapped_column(Integer, nullable=False)
    width: Mapped[int] = mapped_column(Integer, nullable=False)
    height: Mapped[int] = mapped_column(Integer, nullable=False)
    offset_x: Mapped[int] = mapped_column(Integer, nullable=False)
    offset_y: Mapped[int] = mapped_column(Integer, nullable=False)
    color: Mapped[str] = mapped_column(String(32), nullable=False)
    label: Mapped[str] = mapped_column(String(255), nullable=False)
    is_processing: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    node_type: Mapped[str] = mapped_column(String(32), nullable=False)

    graph: Mapped[Graph] = relationship("Graph", back_populates="nodes")
    outgoing_edges: Mapped[list["Edge"]] = relationship(
        "Edge",
        back_populates="from_node",
        foreign_keys="Edge.from_node_id",
        cascade="all, delete-orphan",
    )
    incoming_edges: Mapped[list["Edge"]] = relationship(
        "Edge",
        back_populates="to_node",
        foreign_keys="Edge.to_node_id",
        cascade="all, delete-orphan",
    )

    expressions: Mapped[list["Expression"]] = relationship(
        "Expression",
        back_populates="node",
        cascade="all, delete-orphan",
        order_by="Expression.idx",
        lazy="selectin",
    )

    @property
    def num_handles(self) -> int:
        return len(self.expressions)


class Expression(Base):
    __tablename__ = "expressions"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    node_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False)
    idx: Mapped[int] = mapped_column(Integer, nullable=False)
    raw_string: Mapped[str] = mapped_column(Text, nullable=False)

    node: Mapped[Node] = relationship("Node", back_populates="expressions")


class Edge(Base):
    __tablename__ = "edges"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    graph_id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), ForeignKey("graphs.id", ondelete="CASCADE"), nullable=False)
    from_node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False
    )
    to_node_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("nodes.id", ondelete="CASCADE"), nullable=False
    )
    handle_index: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    graph: Mapped[Graph] = relationship("Graph", back_populates="edges")
    from_node: Mapped[Node] = relationship(
        "Node", foreign_keys=[from_node_id], back_populates="outgoing_edges", lazy="joined"
    )
    to_node: Mapped[Node] = relationship(
        "Node", foreign_keys=[to_node_id], back_populates="incoming_edges", lazy="joined"
    )
