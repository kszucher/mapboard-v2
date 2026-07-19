import type { StateCreator } from 'zustand';
import { runLayout } from '../layout';
import type { GraphStoreState, HistorySlice } from '../types';
import { apiClient } from '../../api/client';
import { fromApiPayload } from '../mappers';

export const createHistorySlice: StateCreator<
  GraphStoreState,
  [],
  [],
  HistorySlice
> = (set, get) => ({
  undo: async () => {
    const { graphId, nodes } = get();
    if (!graphId) return;

    try {
      const res = await apiClient.POST('/graphs/{graph_id}/history/undo', {
        params: { path: { graph_id: graphId } },
      });
      if ('error' in res) throw res.error;

      const data = res.data;
      if (data) {
        const currentPositions = Object.fromEntries(nodes.map(n => [n.id, n.position]));
        const mapped = fromApiPayload(data.nodes, data.edges, currentPositions);

        const laidOut = await runLayout(mapped.nodes, mapped.edges);
        set({
          code: data.code || '',
          nodes: laidOut.nodes,
          edges: laidOut.edges,
          variables: data.variables || [],
          functions: data.functions || [],
          canUndo: data.can_undo ?? false,
          canRedo: data.can_redo ?? false,
          errorMessage: null,
        });
      }
    } catch (err: any) {
      console.error('Failed to undo:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },

  redo: async () => {
    const { graphId, nodes } = get();
    if (!graphId) return;

    try {
      const res = await apiClient.POST('/graphs/{graph_id}/history/redo', {
        params: { path: { graph_id: graphId } },
      });
      if ('error' in res) throw res.error;

      const data = res.data;
      if (data) {
        const currentPositions = Object.fromEntries(nodes.map(n => [n.id, n.position]));
        const mapped = fromApiPayload(data.nodes, data.edges, currentPositions);

        const laidOut = await runLayout(mapped.nodes, mapped.edges);
        set({
          code: data.code || '',
          nodes: laidOut.nodes,
          edges: laidOut.edges,
          variables: data.variables || [],
          functions: data.functions || [],
          canUndo: data.can_undo ?? false,
          canRedo: data.can_redo ?? false,
          errorMessage: null,
        });
      }
    } catch (err: any) {
      console.error('Failed to redo:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },
});
