import { create } from 'zustand';
import type { GraphStoreState } from './types';

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  graphId: null,
  code: '',
  selectedNodeId: null,
  selectedSlotId: null,

  init: (graphId) => {
    set({
      graphId,
      code: '',
      selectedNodeId: null,
      selectedSlotId: null,
    });
  },

  setSelectedIds: (nodeId, slotId) => {
    const { graphId } = get();
    if (!graphId) return;

    if (nodeId === null) {
      set({ selectedNodeId: null, selectedSlotId: null });
      return;
    }

    set({
      selectedNodeId: nodeId,
      selectedSlotId: slotId,
    });
  },

  clearSlotSelection: () => {
    set({ selectedSlotId: null });
  },

  clearNodeSelection: () => {
    set({ selectedNodeId: null, selectedSlotId: null });
  },
}));
