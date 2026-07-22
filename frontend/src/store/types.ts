export interface BaseState {
  graphId: string | null;
  code: string; // local code buffer for CodeMirror
}

export interface UiActions {
  init: (graphId: string) => void;
}

export type GraphStoreState = BaseState & UiActions;
