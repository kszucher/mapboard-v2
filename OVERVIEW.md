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

### 4. Layout & Edge Routing (Agentic AI Workflow Visualization)
Graphboard optimizes layout presentation to focus visual attention on the primary linear agent execution sequence while keeping feedback loops cleanly isolated:
- **Layout Calculation (ELK)**: Uses the ELK layered algorithm to position nodes. Crucially, **backward edges (feedback loops) are filtered out prior to passing the edge set to ELK**. This guarantees that introducing or editing backward loops does not distort, shift, or alter the stable layout of the main forward execution path.
- **Forward Edges (Main Flow)**: Rendered as clean, smooth **bezier curves** (`getBezierPath`) to highlight the linear main pipeline flow.
- **Backward Edges (Feedback Loops)**: Routed around the outside of the graph using a custom **AABB hull algorithm**. To prevent overlaps, back edges are dynamically sorted geometrically and mapped to **non-crossing parallel lanes** with capped vertical and horizontal offsets.

---

### Unit of Work & Transaction Management
The backend utilizes the **Unit of Work (UoW)** pattern (`app/context.py`) to manage database sessions and repositories:
- **Atomicity**: Ensures that multiple operations (e.g., deleting a node and its edges) occur within a single transaction.
- **Event Buffering**: WebSocket events are buffered within the UoW. They are only broadcasted to clients **after** the database transaction has successfully committed. This prevents "phantom" UI updates if a server-side error occurs.
- **Centralized Repositories**: All database access is channeled through repositories lazy-loaded via the UoW (e.g., `uow.nodes`, `uow.expressions`).

---

## Recent Major Improvements
- **Auto-Layout Alignment**: Integrated client-side `elkjs` layout calculation in React Flow (utilizing measured custom node dimensions to prevent overlap) paired with a high-performance backend `PATCH /nodes/bulk-offset` endpoint for atomic coordinate storage and WebSocket broadcasting.
- **Unit of Work Pattern**: Standardized transaction handling and event consistency.
- **Type-Safe Constants**: Replaced all "magic strings" for node types and event names with centralized Enums (`app/constants.py`).
- **Migration to Atomic Expressions**: Transitioned from bulk-updating node expressions to individual CRUD endpoints for Expressions.
- **UUID-based Handles**: Handles on switch nodes now use Expression UUIDs instead of numeric indices.


---

## Project Structure
- `frontend/`: React source code, API clients, and components.
- `python-backend/`: FastAPI application, database models, and service layer.
- `python-backend/alembic/`: Database migration history.
- `python-backend/app/`: Primary backend logic (nodes, edges, expressions, graphs).
