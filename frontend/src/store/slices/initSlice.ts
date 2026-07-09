import type { StateCreator } from 'zustand';
import { apiClient } from '../../api/client';
import { mapToReactFlowElements, runLayout } from '../../utils/flowUtils';
import { resetLastSavedState } from '../helpers';
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
          nodes: mapped.nodes,
          edges: mapped.edges,
          isLoading: mapped.nodes.length > 0,
        });

        resetLastSavedState({
          graphId,
          nodes: mapped.nodes,
          edges: mapped.edges,
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
        nodes: laidOut.nodes,
        edges: laidOut.edges,
      });
    });
  },
});
