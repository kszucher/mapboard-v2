# Graphboard Project Overview

Graphboard is a real-time, logic-driven graph editor designed for building agentic workflows and complex conditional routing. It uses a node-based interface to manage data flows, agent prompts, and logical switches.

## Technology Stack

### Frontend
- **Core**: React with TypeScript.
- **Flow Engine**: [XYFlow (React Flow)](https://reactflow.dev/) for the node-based canvas.
- **State Management**: [TanStack Query (React Query)](https://tanstack.com/query/latest) for server state handling.
- **UI Components**: [Radix UI Themes](https://www.radix-ui.com/themes/docs/overview/introduction) for styling and layout.
- **Editor**: [CodeMirror](https://codemirror.net/) for inline logic and prompt editing.
- **Communication**: WebSockets for real-time multi-client synchronization.

### Backend
- **Framework**: Python [FastAPI](https://fastapi.tiangolo.com/).
- **Database**: [SQLAlchemy](https://www.sqlalchemy.org/) (Async) with [PostgreSQL](https://www.postgresql.org/) (managed via Alembic migrations).
- **Validation**: [Pydantic](https://docs.pydantic.dev/) for API schemas.
- **Event Bus**: Custom WebSocket broker for broadcasting graph mutations.

---

## Core Concepts

### 1. Nodes
Nodes represent functional units in the graph.
- **START**: Entry point for execution.
- **LOGIC**: Basic execution nodes containing an expression.
- **AGENT**: Prompt-based nodes for AI agent interactions.
- **SWITCH (Logical/Agentic)**: Conditional routing nodes with multiple output branches.

### 2. Expressions
Expressions are first-class entities owned by nodes. 
- They contain the logic (e.g., `state.x = 10`) or prompts.
- In Switch nodes, each branch corresponds to exactly one Expression.

### 3. Edges & "Hard Links"
Edges connect nodes. A critical feature of Graphboard is **Hard Links**:
- Edges are connected to specific **Expression IDs** via the `from_expression_id` field.
- This ensures that if you reorder branches in a Switch node, the outgoing wires stay attached to the correct logic/condition rather than breaking or shifting.

---

## Key Architectures

### Real-Time Synchronization
The app uses a "Broadcast and Invalidate" pattern:
1. Client sends a mutation (e.g., `PATCH /nodes/...`).
2. Backend updates the DB and broadcasts a `node_updated` event via WebSockets.
3. All clients (including the sender) receive the event and invalidate the relevant TanStack Query keys.
4. UI refreshes automatically.

### Optimistic Updates
To maintain a snappy feel, major operations (like updating position or deleting expressions) use **Optimistic UI Updates**. The UI reflects the change immediately while the network request is in flight.

---

## Recent Major Improvements
- **Migration to Atomic Expressions**: Transitioned from bulk-updating node expressions to individual CRUD endpoints for Expressions.
- **UUID-based Handles**: Handles on switch nodes now use Expression UUIDs instead of numeric indices (`0`, `1`, `2`).
- **Legacy Mapper**: A runtime resolution layer in the frontend bridges the gap for older graphs that still use index-based edges.

---

## Project Structure
- `frontend/`: React source code, API clients, and components.
- `python-backend/`: FastAPI application, database models, and service layer.
- `python-backend/alembic/`: Database migration history.
- `python-backend/app/`: Primary backend logic (nodes, edges, expressions, graphs).
