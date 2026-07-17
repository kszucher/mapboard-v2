import type { StateCreator } from 'zustand';
import type { ApiSlot } from '../../components/types';
import { runTransaction } from '../storeEngine';
import type { GraphStoreState, SlotSlice } from '../types';

export const createSlotSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  SlotSlice
> = (set, get) => ({
  createSlot: async (nodeId, idx) => {
    await runTransaction(set, get, (state) => {
      const nextNodes = state.nodes.map(n => {
        const isTargetNode = n.id === nodeId;
        const slots = n.data.node.slots.map(s => ({ ...s, selected: false }));

        if (isTargetNode) {
          const newSlot: ApiSlot = {
            id: crypto.randomUUID(),
            raw_string: '',
            selected: true,
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
        }

        const hadSelection = n.data.node.slots.some(s => s.selected);
        if (!hadSelection) return n;

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

    const currentIndex = node.data.node.slots.findIndex(s => s.id === slotId);
    const targetSelectSlotId = currentIndex > 0 ? node.data.node.slots[currentIndex - 1].id : null;

    await runTransaction(set, get, (state) => {
      const nextNodes = state.nodes.map(n => {
        const isTargetNode = n.id === node.id;

        if (isTargetNode) {
          const nextSlots = n.data.node.slots
            .filter(s => s.id !== slotId)
            .map(s => ({
              ...s,
              selected: s.id === targetSelectSlotId,
            }));

          return {
            ...n,
            data: {
              ...n.data,
              node: {
                ...n.data.node,
                slots: nextSlots,
              }
            }
          };
        }

        const hadSelection = n.data.node.slots.some(s => s.selected);
        if (!hadSelection) return n;

        return {
          ...n,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              slots: n.data.node.slots.map(s => ({ ...s, selected: false })),
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

    const shouldSkipHistory = !('selected' in updates);
    const shouldSkipLayout = 'selected' in updates && Object.keys(updates).length === 1;

    const prevSelectedNode = get().nodes.find(n => n.data.node.slots.some(s => s.selected));

    await runTransaction(set, get, (state) => {
      const shouldClearOthers = updates.selected === true;
      const nextNodes = state.nodes.map(n => {
        const isTargetNode = n.id === node.id;
        const isPrevSelectedNode = shouldClearOthers && prevSelectedNode && n.id === prevSelectedNode.id;

        if (!isTargetNode && !isPrevSelectedNode) {
          return n;
        }

        const slots = n.data.node.slots.map(s => {
          if (s.id === slotId) {
            return { ...s, ...updates };
          } else if (shouldClearOthers && s.selected) {
            return { ...s, selected: false };
          }
          return s;
        });

        const hasSlotChanges = slots.some((s, idx) => s !== n.data.node.slots[idx]);
        if (!hasSlotChanges) {
          return n;
        }

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

      const nextEdges = state.edges;

      return {
        nodes: nextNodes,
        edges: nextEdges,
      };
    }, { skipHistory: shouldSkipHistory, skipLayout: shouldSkipLayout });
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

    await runTransaction(set, get, (state) => {
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

  clearSlotSelection: async () => {
    const hasAnySelected = get().nodes.some(n => n.data.node.slots.some(s => s.selected));
    if (!hasAnySelected) return;

    await runTransaction(set, get, (state) => {
      const nextNodes = state.nodes.map(n => {
        const hasSelected = n.data.node.slots.some(s => s.selected);
        if (!hasSelected) return n;

        return {
          ...n,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              slots: n.data.node.slots.map(s => s.selected ? { ...s, selected: false } : s),
            }
          }
        };
      });

      return {
        nodes: nextNodes,
        edges: state.edges,
      };
    }, { skipHistory: false, skipLayout: true });
  },
});
