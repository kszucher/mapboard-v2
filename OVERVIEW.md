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
Graphboard optimizes layout presentation to focus visual attention on the primary linear agent execution sequence while keeping feedback loops cleanly isolated:
- **Layout Calculation (ELK)**: Uses the ELK layered algorithm to position nodes. Crucially, **backward edges (feedback loops) are filtered out prior to passing the edge set to ELK** (implemented in `frontend/src/components/layout.ts`). This guarantees that introducing or editing backward loops does not distort, shift, or alter the stable layout of the main forward execution path.
- **Forward Edges (Main Flow)**: Rendered as clean, smooth **bezier curves** (`getBezierPath`) to highlight the linear main pipeline flow.
- **Backward Edges (Feedback Loops)**: Drop down vertically in the column gap to the right of their source column, run horizontally along the bottom of the graph (calculated via an AABB hull boundary), and rise back up to their target. To prevent overlaps and crossings, routing is split across these key architectural steps:
  1. **Dynamic Layer Clustering (`getDynamicLayers` in `frontend/src/components/shared/edgeUtils.ts`)**: Clusters nodes into integer columns at render time based on X coordinates, bypassing React Flow state-synchronization limits to guarantee stable, real-time coordinate columns.
  2. **Global Track Coloring (`assignBackLinkTracks` in `frontend/src/components/shared/edgeUtils.ts`)**: Models all feedback loops as layer span intervals `[targetLayer, sourceLayer]` and uses a greedy coloring algorithm to assign unique track indexes. Shorter loops (inner nested loops) receive lower track indexes (inner corridors closer to nodes) to ensure nested routing. Disjoint loops share tracks to minimize space, while overlapping loops (e.g., layers 1-to-3 and 2-to-4) get separate tracks and only cross at unavoidable intersection points. Identical intervals break ties by sorting source/target Y positions descending (lower on screen gets a lower track first) so outer/higher loops route around inner/lower ones.
  3. **Path Routing & Sub-Lanes (`FlowEdge.tsx`)**: Gathers column-local backedges and sorts them by their global track indexes to compute local drop-down and target-approach sub-lanes. The first drop lane is placed at `maxRight + 40px`, and the target approach lane is at `targetX - 35px`, preventing overlapping vertical wire overlaps.
  4. **Performance Caching**: To prevent redundant $O(N^2)$ recalculations (since React Flow renders custom edges independently), both layer clustering and track coloring check for reference equality (`===`) of the input node/edge arrays and hit a module-level cache if unchanged, reducing calculations to exactly once per render cycle.


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
