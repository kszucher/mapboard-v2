import { create } from 'zustand';
import type { components } from '../api/generated/schema';
import { queryClient } from '../api/queryClient';
import { queryKeys } from '../api/queryKeys';
import { getNextDownstreamNodeId, getNextUpstreamNodeId, getSiblingNodeId } from '../domain/graph/traversal';
import type { GraphStoreState } from './types';

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  graphId: null,
  code: '',
  selectedNodeId: null,
  selectedSlotId: null,
  selectedEdgeId: null,
  lastKnownSlotIndex: null,

  init: (graphId) => {
    set({
      graphId,
      code: '',
      selectedNodeId: null,
      selectedSlotId: null,
      selectedEdgeId: null,
      lastKnownSlotIndex: null,
    });
  },

  setSelectedIds: (nodeId, slotId) => {
    const { graphId } = get();
    if (!graphId) return;

    if (nodeId === null) {
      set({ selectedNodeId: null, selectedSlotId: null, selectedEdgeId: null, lastKnownSlotIndex: null });
      return;
    }

    let slotIndex: number | null = null;
    if (slotId !== null) {
      const cached = queryClient.getQueryData<components['schemas']['GraphFlowRead']>(queryKeys.graphs.flow(graphId));
      const node = cached?.nodes?.find((n: components['schemas']['NodeRead']) => n.id === nodeId);
      const index = node?.slots?.findIndex((s: components['schemas']['SlotRead']) => s.id === slotId);
      if (index !== undefined && index !== -1) {
        slotIndex = index;
      }
    }

    // Selecting a node or slot ALWAYS deselects edges
    set({
      selectedNodeId: nodeId,
      selectedSlotId: slotId,
      selectedEdgeId: null,
      lastKnownSlotIndex: slotIndex,
    });
  },

  setSelectedEdgeId: (edgeId) => {
    // Selecting an edge ALWAYS deselects nodes and slots
    set({
      selectedEdgeId: edgeId,
      selectedNodeId: null,
      selectedSlotId: null,
      lastKnownSlotIndex: null,
    });
  },

  handleEdgesChange: (changes) => {
    const selectChanges = changes.filter(
      (c): c is Extract<typeof changes[number], { type: 'select' }> => c.type === 'select'
    );
    const selectChange = selectChanges.find(c => c.selected);

    if (selectChange) {
      get().setSelectedEdgeId(selectChange.id);
    } else if (selectChanges.some(c => !c.selected)) {
      const currentEdgeId = get().selectedEdgeId;
      if (selectChanges.some(c => c.id === currentEdgeId && !c.selected)) {
        get().setSelectedEdgeId(null);
      }
    }
  },

  clearSlotSelection: () => {
    set({ selectedSlotId: null, lastKnownSlotIndex: null });
  },

  clearNodeSelection: () => {
    set({ selectedNodeId: null, selectedSlotId: null, selectedEdgeId: null, lastKnownSlotIndex: null });
  },

  clearSelection: () => {
    set({ selectedNodeId: null, selectedSlotId: null, selectedEdgeId: null, lastKnownSlotIndex: null });
  },

  reconcileSelection: (newNodes) => {
    const { selectedNodeId, selectedSlotId, lastKnownSlotIndex } = get();
    if (!selectedNodeId) return;

    const node = newNodes.find(n => n.id === selectedNodeId);
    if (!node) {
      // Node was deleted: clear selection
      set({ selectedNodeId: null, selectedSlotId: null, selectedEdgeId: null, lastKnownSlotIndex: null });
      return;
    }

    const slots = node.data?.node?.slots || [];

    if (selectedSlotId) {
      const currentSlotIndex = slots.findIndex(s => s.id === selectedSlotId);
      if (currentSlotIndex !== -1) {
        // Slot is still present: update its index tracking
        set({ lastKnownSlotIndex: currentSlotIndex });
        return;
      }

      // Slot was deleted: apply fallback rules (above, then below, then parent node)
      if (lastKnownSlotIndex !== null) {
        if (lastKnownSlotIndex > 0 && slots.length > 0) {
          // Select slot above
          const targetIndex = lastKnownSlotIndex - 1;
          set({ selectedSlotId: slots[targetIndex].id, lastKnownSlotIndex: targetIndex });
        } else if (slots.length > 0) {
          // Select slot below (shifted to 0)
          set({ selectedSlotId: slots[0].id, lastKnownSlotIndex: 0 });
        } else {
          // Fallback to parent node
          set({ selectedSlotId: null, lastKnownSlotIndex: null });
        }
      } else {
        set({ selectedSlotId: null, lastKnownSlotIndex: null });
      }
    }
  },

  selectNextSlot: (nodes) => {
    const { selectedNodeId, selectedSlotId } = get();
    if (!selectedNodeId || !selectedSlotId) return;

    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;

    const slots = node.data?.node?.slots || [];
    const currentIndex = slots.findIndex(s => s.id === selectedSlotId);
    if (currentIndex !== -1 && currentIndex < slots.length - 1) {
      const nextSlot = slots[currentIndex + 1];
      set({ selectedSlotId: nextSlot.id, lastKnownSlotIndex: currentIndex + 1 });
    }
  },

  selectPreviousSlot: (nodes) => {
    const { selectedNodeId, selectedSlotId } = get();
    if (!selectedNodeId || !selectedSlotId) return;

    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;

    const slots = node.data?.node?.slots || [];
    const currentIndex = slots.findIndex(s => s.id === selectedSlotId);
    if (currentIndex > 0) {
      const prevSlot = slots[currentIndex - 1];
      set({ selectedSlotId: prevSlot.id, lastKnownSlotIndex: currentIndex - 1 });
    }
  },

  selectFirstSlot: (nodes) => {
    const { selectedNodeId } = get();
    if (!selectedNodeId) return;

    const node = nodes.find(n => n.id === selectedNodeId);
    if (!node) return;

    const slots = node.data?.node?.slots || [];
    if (slots.length > 0) {
      set({ selectedSlotId: slots[0].id, lastKnownSlotIndex: 0 });
    }
  },

  selectSiblingNode: (direction, nodes, edges) => {
    const { selectedNodeId } = get();
    if (!selectedNodeId) return;

    const siblingId = getSiblingNodeId(selectedNodeId, direction, nodes, edges);
    if (siblingId) {
      set({ selectedNodeId: siblingId, selectedSlotId: null, lastKnownSlotIndex: null });
    }
  },

  selectTraversalNode: (direction, nodes, edges) => {
    const { selectedNodeId } = get();
    if (!selectedNodeId) return;

    const targetId = direction === 'right'
      ? getNextDownstreamNodeId(selectedNodeId, nodes, edges)
      : getNextUpstreamNodeId(selectedNodeId, nodes, edges);

    if (targetId) {
      set({ selectedNodeId: targetId, selectedSlotId: null, lastKnownSlotIndex: null });
    }
  },
}));
