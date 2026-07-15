# Graphboard

Graphboard is a logic-driven graph editor for building, compiling, and visualizing **LangGraph** workflows. Unlike traditional free-form canvas tools, Graphboard enforces fully programmatic auto-layout using ELK and binds execution connections directly to structured code templates.

### Project Status & Evolution
This repository serves as a personal, non-commercial R&D exploration and a continuous playground for full-stack AI system design. It builds upon ideas from a previous project (Mapboard) with two fundamental architectural shifts:
* **Backend Stack:** Migrated from Nest.js/Node.js to a Python/FastAPI ecosystem.
* **Execution Strategy:** Replaced a bespoke, custom DAG execution engine with an ongoing, active implementation of a LangGraph-based state machine interpreter. 

*As an active work-in-progress experiment, this codebase is primarily dedicated to skill acquisition, showcasing advanced conversational state control, and prototyping dynamic graph translation layer concepts.*

---

Below is a screenshot of the AI workflow of a well-known "Who wants to be a millionaire" game, including handling intent routing, handling retries, and supporting complex state logic e.g. using lifelines. 

<img width="1980" height="1080" alt="Image" src="https://github.com/user-attachments/assets/dc6bf916-0dcb-40ca-aa49-36ea0802aedc" />

---

## 1. Core Concept & Visual Node Roles

In Graphboard, agentic logic is structured into three fundamental node types. Each node maps a specific visual layout element to a corresponding block of Python code:

### STEP Node (Sequential Execution)
* **Role**: Represents an action step that performs modifications, calculations, or triggers external tasks.
* **Visual Structure**: Has a single input slot on the left and a single output slot on the right.
* **Code Representation**: A sequential block of Python expressions or variable updates (e.g. `x = x + 1` or `status = "processing"`).
* **Linter Rule**: Restricts against pointless expressions; enforces assignments or valid function calls.

### SWITCH Node (Decision & Routing)
* **Role**: Evaluates branching logic to dynamically route control flow to one of several downstream nodes.
* **Visual Structure**: Has a single input slot on the left and multiple output slots (branches) on the right.
* **Code Representation**: An `if`/`elif`/`else` condition block mapping to target routes.
* **Linter Rule**: Permits plain comparison expressions (e.g. `mark_cntr > 10`), while strictly forbidding assignments (e.g. `mark_cntr = 1`).

### JOIN Node (Branch Synchronization & Resolution)
* **Role**: Merges multiple parallel or alternative execution branches back into a single thread.
* **Visual Structure**: Has multiple input slots on the left and a single output slot on the right.
* **Code Representation**: A variable selector block determining final state values based on which branch was triggered (e.g. `if was_triggered(branch_a): my_var = x`).

---

## 2. Project Progress Tracker (Incremental Status)

To help future AI agents and developers understand the exact state of the codebase, here is the incremental breakdown of what has been implemented so far, followed by the immediate next steps:

### Phase 1: Core Graph & Layout Foundation (Implemented)
* **Programmatic Auto-Layout**: Configured React Flow to disable manual node dragging (`nodesDraggable: false`) and delegate all positioning calculations to ELK.
* **Slot-Based Handling**: Implemented explicit input/output slots for nodes, replacing generic connections.
* **Detour Back-Edge Routing**: Detected backward execution paths (feedback loops) and routed them manually around the bottom of the graph to avoid distorting ELK layouts.
* **Handles Lifecycle Sync**: Added automatic React Flow handle cache updates via `updateNodeInternals` when slot configurations toggle.
* **Animation Transition Smoothness**: Mapped screen coordinates before history changes to trigger clean sliding animations on undo/redo.

### Phase 2: State & Synchronization Layer (Implemented)
* **FastAPI Backend Port**: Rewrote the server from Node.js/Nest.js to Python/FastAPI.
* **Optimistic Store Sync**: Integrated a Zustand store on the frontend that updates memory instantly, synchronizing with the database asynchronously.
* **UoW Event Buffering**: Configured a FastAPI Unit of Work transaction manager that buffers WebSocket broadcasts until transactions commit successfully.

### Phase 3: Workspace Editor UI (Implemented)
* **Sidebar Metadata Controls**: Added a left sidebar panel to manage variables and custom function definitions.
* **CodeMirror Python Editor**: Integrated a CodeMirror 6 Python slot editor into the sidebar.
* **Approve/Discard Guards**: Added local state buffers and UI control buttons so users must explicitly save or revert expression changes.
* **Canvas Interception Prevention**: Disabled global canvas hotkeys when the cursor is focused inside inputs or CodeMirror editors.

### Phase 4: Linter & Type-Checking Engine (Implemented)
* **Ruff WASM Integration**: Dynamically initialized the Ruff linter in the browser using custom variables and functions as recognized python `builtins`.
* **Augmented Assignment Checking**: Built a custom type checker (`runTypeCheck`) to validate variable assignments, including complex updates like `+=`, `-=`, `*=`, `/=`.
* **Function Reference Verification**: Added a negative-lookahead check to flag custom functions used without parentheses (e.g., `x` is invalid, `x()` is valid).
* **Context-Aware Rules**: Tailored lint rules depending on node context (e.g., allowing boolean expressions on `SWITCH` nodes while blocking assignments).
* **Always-on Status Panel**: Added a dedicated visual diagnostics panel showing clear status and line-by-line syntax or type errors with line numbers.
* **Autocompletion**: Added autocomplete suggestions for registered variables and custom functions.

---

## 3. Immediate Next Steps (Roadmap)

1. **Auto-Slugification**: Automatically convert human-readable node/slot labels into valid `snake_case` Python identifiers as you type.
2. **Switch Node Control-Flow Templates**: Scaffold read-only `if`/`elif`/`else` templates in CodeMirror for `SWITCH` slots, mapping connections to Python routes automatically.
3. **Join Node Value Resolvers**: Auto-generate `was_triggered(branch)` templates for `JOIN` nodes to merge upstream values into variables.
4. **Backend LangGraph DAG Compiler**: Build the FastAPI/Python compiler to translate the visual layout and code blocks into an executable LangGraph state machine.

---

## 4. Core System Architecture & Design Choices

### Local Zustand Store vs. DB Referential Integrity
To keep UI edits and typing latency-free, the frontend implements a local Zustand store updating in memory. Frontend changes are synced asynchronously, relying on UI reconciliation for conflict resolution.

### Auto-Layout ONLY (No Drag-and-Drop)
React Flow's `nodesDraggable` is set to `false`. Node coordinates `(x, y)` are computed on the fly by ELK in the frontend using node dimensions. Slot edits trigger a debounced (1000ms) ELK recalculation once resizing finishes.

### Node Slot Ports & Order Rules
Nodes contain **Slots** with explicit `is_input` and `is_output` flags. 
* **Sequential Ordering Constraint**: Slots inside a node must follow a strict flow-logic order:
  `Inputs -> Both -> None -> Outputs`
* **Hard Links**: Edge connections store specific `from_slot_id` and `to_slot_id`. If slots are reordered, connecting wires stay attached to their logic rows.

### Feedback Loops & Detour Routing
Connections moving backwards (target node column <= source node column) are feedback loops. They are filtered out before passing the graph to ELK to avoid distorting layout dimensions and manually routed around the bottom of the graph in `edgeUtils.ts`.

---

## 5. Key Implementation Gotchas

* **Unconditional Layout Transitions**: Visual CSS transitions (`transition: transform 400ms...`) are applied statically to node styles in `flowUtils.ts` when elements are mapped. React Flow forwards this to the outer wrapper, animating all coordinate updates.
* **Undo/Redo Animation Trigger**: The history snapshots store final layout positions. If loaded directly, React Flow snaps nodes instantly. To trigger slide animations, `historySlice.ts` maps the *current screen positions* onto the history nodes *before* running ELK. Do not bypass this mapping.
* **Unit of Work (UoW) Event Buffering**: Backend FastAPI mutations are grouped in a Unit of Work transaction (`app/context.py`). WebSocket events are buffered and only broadcast to other clients *after* the database transaction commits successfully.
* **Custom Handles Lifecycle & `updateNodeInternals`**: When slots change type (adding/removing input/output handles), React Flow's DOM-cached registry becomes stale. We must compute a stable `slotsHash` in `FlowNode.tsx` and run a `useEffect` triggering `updateNodeInternals(id)` whenever the hash changes to force React Flow to re-query the handles.
