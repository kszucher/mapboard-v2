from __future__ import annotations

import uuid
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict

from app.constants import EventName

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


# Base classes
class OrmModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# Shared event model
class GraphEvent(BaseModel):
    event: EventName
    graph_id: uuid.UUID
    payload: dict[str, Any]
    sender_client_id: str | None = None
