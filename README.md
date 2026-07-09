# Graphboard

Graphboard is a logic-driven graph editor for building agentic workflows. Unlike typical canvas editors, Graphboard enforces **fully programmatic auto-layout** (via ELK) and binds connections to slots.

---

## Core System Architecture & Non-Standard Choices

### 1. Local Zustand Store vs. DB Referential Integrity
To keep UI edits, logic typing, and updates lag-free, the frontend implements a local Zustand store that updates optimistically in memory. 
* **Trade-off**: The store operates without strict database referential integrity checks during edits. Frontend state changes are synchronized asynchronously, and the UI is responsible for managing reconciliation on conflicts.

### 2. Auto-Layout ONLY (No Drag-and-Drop)
* React Flow's `nodesDraggable` is set to `false`. Node coordinates `(x, y)` are computed on the fly by ELK in the frontend using node dimensions.
* **Resizing & Debounce**: Typing inline changes node height. To prevent layout stuttering, slot edits are debounced (1000ms). Once resizing stops, updated dimensions trigger a fresh ELK layout.

### 3. Node Slot Ports & Order Rules
Nodes do not have generic ports; they contain **Slots** with explicit `is_input` and `is_output` flags (which render left target handles and right source handles, respectively).
* **Sequential Ordering Constraint**: Slots inside a node must follow a strict flow-logic order:
  `Inputs -> Both -> None -> Outputs`
  Violations will trigger validation errors.
* **Hard Links**: Edge connections store the specific `from_slot_id` and `to_slot_id`. If slots are reordered, the connecting wires stay attached to their logic rows.

### 4. Feedback Loops & Detour Routing
Because graph execution flows left-to-right starting from `START`, any connection moving backwards (target node column <= source node column) is a feedback loop.
* **Layout Isolation**: These back-edges are filtered out before passing the graph to ELK to avoid distorting layout dimensions.
* **Detour Paths**: They are manually routed around the bottom of the graph using a track coloring interval algorithm in `edgeUtils.ts`.

---

## Key Implementation Gotchas

* **Unconditional Layout Transitions**: Visual CSS transitions (`transition: transform 400ms...`) are applied statically to node styles in `flowUtils.ts` when elements are mapped. React Flow forwards this to the outer wrapper, animating all coordinate updates.
* **Undo/Redo Animation Trigger**: The history snapshots store final layout positions. If loaded directly, React Flow snaps nodes instantly. To trigger slide animations, `historySlice.ts` maps the *current screen positions* onto the history nodes *before* running ELK. Do not bypass this mapping.
* **Unit of Work (UoW) Event Buffering**: Backend FastAPI mutations are grouped in a Unit of Work transaction (`app/context.py`). WebSocket events are buffered and only broadcast to other clients *after* the database transaction commits successfully.
* **Custom Handles Lifecycle & `updateNodeInternals`**: When slots change type (adding/removing input/output handles), React Flow's DOM-cached registry becomes stale. We must compute a stable `slotsHash` in `FlowNode.tsx` and run a `useEffect` triggering `updateNodeInternals(id)` whenever the hash changes to force React Flow to re-query the handles.
