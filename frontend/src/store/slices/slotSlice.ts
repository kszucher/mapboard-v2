import type { StateCreator } from 'zustand';
import type { GraphStoreState, SlotSlice } from '../types';
import { apiClient, getClientId } from '../../api/client';
import { applyGraphFlowUpdate } from './nodeSlice';

export const createSlotSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  SlotSlice
> = (set, get) => ({
  createSlot: async (nodeId, idx) => {
    const { graphId } = get();
    if (!graphId) return;

    try {
      const res = await apiClient.POST('/graphs/{graph_id}/nodes/{node_id}/slots', {
        params: { path: { graph_id: graphId, node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
        body: { index: idx }
      });
      if ('error' in res) throw res.error;
      if (res.data) {
        await applyGraphFlowUpdate(set, get, res.data);

        // Client-side visual slot selection after creation
        set((state) => {
          const nextNodes = state.nodes.map(n => {
            if (n.id !== nodeId) return n;
            const slots = n.data.node.slots.map((s, sIdx) => ({
              ...s,
              selected: sIdx === idx,
            }));
            return {
              ...n,
              selected: false,
              data: {
                ...n.data,
                node: {
                  ...n.data.node,
                  selected: false,
                  slots,
                }
              }
            };
          });
          return { nodes: nextNodes };
        });
      }
    } catch (err: any) {
      console.error('Failed to create slot:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },

  deleteSlot: async (slotId) => {
    const { graphId, nodes } = get();
    if (!graphId) return;

    const node = nodes.find(n => n.data.node.slots.some(s => s.id === slotId));
    if (!node) return;

    if (node.data.node.slots.length <= 1) {
      set({ errorMessage: 'Cannot delete the last remaining slot of this node.' });
      return;
    }

    try {
      const res = await apiClient.DELETE('/graphs/{graph_id}/slots/{slot_id}', {
        params: { path: { graph_id: graphId, slot_id: slotId } },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
      if (res.data) {
        await applyGraphFlowUpdate(set, get, res.data);
      }
    } catch (err: any) {
      console.error('Failed to delete slot:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },

  updateSlot: async (slotId, updates) => {
    // Visual selection updates are client-side only
    if (updates.selected !== undefined && updates.raw_string === undefined) {
      set((state) => {
        const shouldClearOthers = updates.selected === true;
        const nextNodes = state.nodes.map(n => {
          const slots = n.data.node.slots.map(s => {
            if (s.id === slotId) {
              return { ...s, selected: !!updates.selected };
            } else if (shouldClearOthers) {
              return { ...s, selected: false };
            }
            return s;
          });
          const nodeSelected = shouldClearOthers ? false : (n.selected ?? false);
          return {
            ...n,
            selected: nodeSelected,
            data: {
              ...n.data,
              node: {
                ...n.data.node,
                selected: nodeSelected,
                slots,
              }
            }
          };
        });
        return { nodes: nextNodes };
      });
      return;
    }

    const { graphId } = get();
    if (!graphId) return;

    try {
      const res = await apiClient.PATCH('/graphs/{graph_id}/slots/{slot_id}', {
        params: { path: { graph_id: graphId, slot_id: slotId } },
        headers: { 'X-Client-Id': getClientId() },
        body: { raw_string: updates.raw_string || '' }
      });
      if ('error' in res) throw res.error;
      if (res.data) {
        await applyGraphFlowUpdate(set, get, res.data);
      }
    } catch (err: any) {
      console.error('Failed to update slot:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },

  moveSlot: async (slotId, direction) => {
    const { graphId } = get();
    if (!graphId) return;

    try {
      const res = await apiClient.POST('/graphs/{graph_id}/slots/{slot_id}/move', {
        params: { path: { graph_id: graphId, slot_id: slotId } },
        headers: { 'X-Client-Id': getClientId() },
        body: { direction }
      });
      if ('error' in res) throw res.error;
      if (res.data) {
        await applyGraphFlowUpdate(set, get, res.data);
      }
    } catch (err: any) {
      console.error('Failed to move slot:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },

  clearSlotSelection: async () => {
    // Purely client-side visual state deselect
    set((state) => {
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
      return { nodes: nextNodes };
    });
  },
});
