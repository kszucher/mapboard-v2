import { create } from 'zustand';
import type { components } from '../api/generated/schema';
import { queryClient } from '../api/queryClient';
import { queryKeys } from '../api/queryKeys';
import type { GraphStoreState } from './types';

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  graphId: null,
  code: '',
  selectedNodeId: null,
  selectedSlotId: null,
  selectedSlotIndex: null,

  init: (graphId) => {
    set({
      graphId,
      code: '',
      selectedNodeId: null,
      selectedSlotId: null,
      selectedSlotIndex: null,
    });
  },

  setSelectedIds: (nodeId, branchIndex) => {
    const { graphId } = get();
    if (!graphId) return;

    if (nodeId === null) {
      set({ selectedNodeId: null, selectedSlotId: null, selectedSlotIndex: null });
      return;
    }

    // Retrieve raw graph nodes from TanStack Query cache to match slot indexing
    const cached = queryClient.getQueryData<components['schemas']['GraphFlowRead']>(queryKeys.graphs.flow(graphId));
    const nodes = cached?.nodes || [];

    const isSlotSelection = branchIndex !== null && branchIndex !== -1;
    let selectedSlotId: string | null = null;
    let selectedSlotIndex: number | null = null;

    if (isSlotSelection) {
      const node = nodes.find((n: components['schemas']['NodeRead']) => n.id === nodeId);
      const slot = node?.slots?.[branchIndex];
      if (slot) {
        selectedSlotId = slot.id;
        selectedSlotIndex = branchIndex;
      }
    }

    set({
      selectedNodeId: nodeId,
      selectedSlotId,
      selectedSlotIndex,
    });
  },

  clearSlotSelection: () => {
    set({ selectedSlotId: null, selectedSlotIndex: null });
  },

  clearNodeSelection: () => {
    set({ selectedNodeId: null, selectedSlotId: null, selectedSlotIndex: null });
  },
}));
