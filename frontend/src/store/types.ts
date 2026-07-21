import type { AppFlowNode } from '../canvas/types';

export interface BaseState {
  graphId: string | null;
  code: string; // local code buffer for CodeMirror
  selectedNodeId: string | null;
  selectedSlotId: string | null;
  lastKnownSlotIndex: number | null;
}

export interface UiActions {
  setSelectedIds: (nodeId: string | null, slotId: string | null) => void;
  clearSlotSelection: () => void;
  clearNodeSelection: () => void;
  reconcileSelection: (newNodes: AppFlowNode[]) => void;
  init: (graphId: string) => void;
}

export type GraphStoreState = BaseState & UiActions;
