import type { StateCreator } from 'zustand';
import { apiClient } from '../../api/client';
import { runLayout } from '../layout';
import { mapToReactFlowElements } from '../mappers';
import { resetLastSavedState } from '../storeEngine';
import type { GraphStoreState, InitSlice } from '../types';

export const createInitSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  InitSlice
> = (set, get) => ({
  init: async (graphId) => {
    set({ graphId, isLoading: true, past: [], future: [] });
    try {
      const res = await apiClient.GET('/graphs/{graph_id}/flow', {
        params: { path: { graph_id: graphId } }
      });
      if ('error' in res) throw res.error;
      const data = res.data;
      if (data) {
        const mapped = mapToReactFlowElements(data.nodes, data.edges, {}, 'none');

        set({
          graphId,
          code: data.code || '',
          nodes: mapped.nodes,
          edges: mapped.edges,
          variables: data.variables || [],
          functions: data.functions || [],
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

  updateFromWebSocket: (flow) => {
    const { graphId, nodes } = get();
    if (!graphId) return;

    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach((n) => {
      positions[n.id] = n.position;
    });

    const mapped = mapToReactFlowElements(flow.nodes, flow.edges, positions);

    runLayout(mapped.nodes, mapped.edges).then(laidOut => {
      set({
        code: flow.code || '',
        nodes: laidOut.nodes,
        edges: laidOut.edges,
        variables: flow.variables || [],
        functions: flow.functions || [],
      });
    });
  },
});
