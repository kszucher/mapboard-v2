export interface BaseState {
  graphId: string | null;
  code: string; // local code buffer for CodeMirror
  selectedNodeId: string | null;
  selectedSlotId: string | null;
  selectedSlotIndex: number | null;
}

export interface UiActions {
  setSelectedIds: (nodeId: string | null, branchIndex: number | null) => void;
  clearSlotSelection: () => void;
  clearNodeSelection: () => void;
  init: (graphId: string) => void;
}

export type GraphStoreState = BaseState & UiActions;
