from __future__ import annotations

import uuid
from typing import Any, Literal, Optional

from pydantic import BaseModel, ConfigDict

# Shared type definitions
ColorMode = Literal["DARK", "LIGHT"]
Color = Literal[
    "gray",
    "gold",
    "bronze",
    "brown",
    "yellow",
    "amber",
    "orange",
    "tomato",
    "red",
    "ruby",
    "crimson",
    "pink",
    "plum",
    "purple",
    "violet",
    "iris",
    "indigo",
    "blue",
    "cyan",
    "teal",
    "jade",
    "green",
    "grass",
    "lime",
    "mint",
    "sky",
]

NodeType = Literal["START", "LOGIC", "AGENT", "LOGICAL_SWITCH", "AGENTIC_SWITCH"]


# Base classes
class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# Shared event model
class GraphEvent(BaseModel):
    event: Literal[
        "graph_created",
        "graph_updated",
        "node_created",
        "node_updated",
        "node_deleted",
        "edge_created",
        "edge_deleted",
        "edges_updated",
    ]
    graph_id: uuid.UUID
    payload: dict[str, Any]
    sender_client_id: Optional[str] = None
