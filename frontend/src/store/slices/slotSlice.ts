import type { StateCreator } from 'zustand';
import type { ApiSlot } from '../../components/types';
import { updateFlowState } from '../helpers';
import type { GraphStoreState, SlotSlice } from '../types';

export const createSlotSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  SlotSlice
> = (set, get) => ({
  createSlot: async (nodeId, isInput, isOutput, idx) => {
    await updateFlowState(set, get, (state) => {
      const nextNodes = state.nodes.map(n => {
        if (n.id !== nodeId) return n;
        const slots = [...n.data.node.slots];
        const newSlot: ApiSlot = {
          id: crypto.randomUUID(),
          is_input: isInput,
          is_output: isOutput,
          raw_string: '',
          indent: 0,
        };
        slots.splice(idx, 0, newSlot);
        return {
          ...n,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              slots,
            }
          }
        };
      });

      return {
        nodes: nextNodes,
        edges: state.edges,
      };
    });
  },

  deleteSlot: async (slotId) => {
    const node = get().nodes.find(n => n.data.node.slots.some(s => s.id === slotId));
    if (!node) return;

    if (node.data.node.slots.length <= 1) {
      set({ errorMessage: 'Cannot delete the last remaining slot of this node.' });
      return;
    }

    await updateFlowState(set, get, (state) => {
      const nextNodes = state.nodes.map(n => {
        if (!n.data.node.slots.some(s => s.id === slotId)) return n;
        return {
          ...n,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              slots: n.data.node.slots.filter(s => s.id !== slotId),
            }
          }
        };
      });

      const nextEdges = state.edges.filter(e => e.sourceHandle !== slotId && e.targetHandle !== slotId);

      return {
        nodes: nextNodes,
        edges: nextEdges,
      };
    });
  },

  updateSlot: async (slotId, updates) => {
    const node = get().nodes.find(n => n.data.node.slots.some(s => s.id === slotId));
    if (!node) return;
    const currentSlot = node.data.node.slots.find(s => s.id === slotId);
    if (!currentSlot) return;

    const hasChanges = Object.entries(updates).some(
      ([key, value]) => currentSlot[key as keyof ApiSlot] !== value
    );
    if (!hasChanges) {
      return;
    }

    const shouldSkipHistory = !('is_input' in updates || 'is_output' in updates);

    await updateFlowState(set, get, (state) => {
      const nextNodes = state.nodes.map(n => {
        if (!n.data.node.slots.some(s => s.id === slotId)) return n;
        return {
          ...n,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              slots: n.data.node.slots.map(s =>
                s.id === slotId ? { ...s, ...updates } : s
              ),
            }
          }
        };
      });

      let nextEdges = state.edges;
      if (updates.is_input === false) {
        nextEdges = nextEdges.filter(e => e.targetHandle !== slotId);
      }
      if (updates.is_output === false) {
        nextEdges = nextEdges.filter(e => e.sourceHandle !== slotId);
      }

      return {
        nodes: nextNodes,
        edges: nextEdges,
      };
    }, { skipHistory: shouldSkipHistory });
  },

  moveSlot: async (slotId, direction) => {
    const node = get().nodes.find(n => n.data.node.slots.some(s => s.id === slotId));
    if (!node) return;

    const slots = [...node.data.node.slots];
    const currentIndex = slots.findIndex(s => s.id === slotId);
    if (currentIndex === -1) return;

    let targetIndex = -1;
    if (direction === 'up' && currentIndex > 0) targetIndex = currentIndex - 1;
    else if (direction === 'down' && currentIndex < slots.length - 1) targetIndex = currentIndex + 1;
    else if (direction === 'top' && currentIndex > 0) targetIndex = 0;
    else if (direction === 'bottom' && currentIndex < slots.length - 1) targetIndex = slots.length - 1;

    if (targetIndex === -1 || targetIndex === currentIndex) return;

    await updateFlowState(set, get, (state) => {
      const nextNodes = state.nodes.map(n => {
        if (n.id !== node.id) return n;
        const slts = [...n.data.node.slots];
        const [moved] = slts.splice(currentIndex, 1);
        slts.splice(targetIndex, 0, moved);
        return {
          ...n,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              slots: slts,
            }
          }
        };
      });
      return {
        nodes: nextNodes,
        edges: state.edges,
      };
    });
  },
});
