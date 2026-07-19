export interface BaseState {
  graphId: string | null;
  code: string; // local code buffer for CodeMirror
  selectedNodeId: string | null;
  selectedSlotId: string | null;
  selectedSlotIndex: number | null;
  isLoading: boolean;
  isSaving: boolean;
  errorMessage: string | null;
  clearErrorMessage: () => void;
}

export interface UiActions {
  setSelectedIds: (nodeId: string | null, branchIndex: number | null) => void;
  clearSlotSelection: () => void;
  init: (graphId: string) => void;
  updateCode: (code: string) => void;
}

export type GraphStoreState = BaseState & UiActions;
