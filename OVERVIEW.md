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

#### 4. Layout & Edge Routing (Agentic AI Workflow Visualization)
Graphboard optimizes workflow readability by separating the stable, linear pipeline flow (bezier curves) from backward feedback loops (orthogonal detour paths). This layout separation is achieved through the following architectural design:

*   **Deterministic Layout Calculation (ELK)**: Auto-layout uses the ELK layered algorithm to organize nodes from left to right. To prevent backward feedback loops from shifting or distorting the layout of the primary DAG sequence, these edges are topologically identified and filtered out *before* the edge set is passed to ELK. Layout calculation is completely independent of visual node positions, ensuring consistent layouts irrespective of manual dragging.
*   **Topological Layer Mapping (`edgeUtils.ts`)**: Instead of dynamic X-coordinate clustering, nodes are mapped to logical columns based on a deterministic topological sort and DFS finish-order starting from `START` node(s) rather than physical coordinates. This topology-first layer assignment is preserved in the node's `data.layer` payload for consistent edge classification.
*   **Greedy Track Allocation (`assignBackLinkTracks`)**: Backward loops are modeled as layer span intervals `[targetLayer, sourceLayer]` and routed around the bottom of the graph using an Interval Coloring track allocation algorithm. Inner nested loops receive lower track indices (routes closer to the nodes) while disjoint loops share tracks to minimize canvas footprint.
*   **Path Routing & Decoupled Geometry (`getBacklinkPath` & `FlowEdge.tsx`)**: Geometrical path computation is completely separated from React rendering views. The utility `getBacklinkPath` dynamically computes orthogonal points and handles local drop-down/approach sub-lanes (placed at `maxRight + 40px` and `targetX - 35px` respectively) to prevent overlapping vertical lines. `FlowEdge.tsx` remains a lightweight React component focused purely on presentation.
*   **Performance Caching**: To prevent redundant $O(N^2)$ recalculations during React Flow edge rendering, both layer mapping and track coloring use reference-caching (`===`) on node/edge arrays, executing exactly once per rendering transaction.


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
