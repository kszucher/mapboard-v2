import { create } from 'zustand';
import { createExecutionSlice } from './slices/executionSlice';
import { createFlowSlice } from './slices/flowSlice';
import { createHistorySlice } from './slices/historySlice';
import { createInitSlice } from './slices/initSlice';
import { createNodeSlice } from './slices/nodeSlice';
import { createSlotSlice } from './slices/slotSlice';
import { setOnSaveStateChange, setOnSyncResponse } from './storeEngine';
import type { GraphStoreState } from './types';

export const useGraphStore = create<GraphStoreState>((set, get, store) => ({
  graphId: null,
  code: '',
  nodes: [],
  edges: [],
  variables: [],
  functions: [],
  past: [],
  future: [],
  isLoading: false,
  isSaving: false,
  errorMessage: null,
  clearErrorMessage: () => set({ errorMessage: null }),
  pendingLayoutNodeId: null,
  selectedNodeId: null,
  selectedSlotId: null,

  ...createInitSlice(set, get, store),
  ...createFlowSlice(set, get, store),
  ...createNodeSlice(set, get, store),
  ...createSlotSlice(set, get, store),
  ...createExecutionSlice(set, get, store),
  ...createHistorySlice(set, get, store),
}));

setOnSaveStateChange((isSaving) => {
  useGraphStore.setState({ isSaving });
});

setOnSyncResponse((data) => {
  if (data.code !== undefined) {
    useGraphStore.setState({ code: data.code });
  }
});
