import type { StateCreator } from 'zustand';
import { apiClient } from '../../api/client';
import { fromApiPayload } from '../mappers';
import { resetLastSavedState } from '../storeEngine';
import type { GraphStoreState, InitSlice } from '../types';

export const createInitSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  InitSlice
> = (set) => ({
  init: async (graphId) => {
    set({ graphId, isLoading: true, canUndo: false, canRedo: false });
    try {
      const res = await apiClient.GET('/graphs/{graph_id}/flow', {
        params: { path: { graph_id: graphId } }
      });
      if ('error' in res) throw res.error;
      const data = res.data;
      if (data) {
        const mapped = fromApiPayload(data.nodes, data.edges, {}, 'none');

        set({
          graphId,
          code: data.code || '',
          nodes: mapped.nodes,
          edges: mapped.edges,
          variables: data.variables || [],
          functions: data.functions || [],
          canUndo: data.can_undo ?? false,
          canRedo: data.can_redo ?? false,
          isLoading: mapped.nodes.length > 0,
        });

        resetLastSavedState({
          graphId,
          code: data.code || '',
          nodes: mapped.nodes,
          edges: mapped.edges,
          variables: data.variables || [],
          functions: data.functions || [],
        });
      } else {
        set({ isLoading: false });
      }
    } catch (err) {
      console.error('Failed to initialize graph:', err);
      set({ isLoading: false });
    }
  },
});
