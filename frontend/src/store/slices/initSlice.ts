import type { StateCreator } from 'zustand';
import { apiClient } from '../../api/client';
import { mapToReactFlowElements, normalizeExpressions, runLayout } from '../../utils/flowUtils';
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
        const positions: Record<string, { x: number; y: number }> = {};
        data.nodes.forEach(n => {
          if (n.position) {
            positions[n.id] = n.position as { x: number; y: number };
          }
        });

        const normalizedExprs = normalizeExpressions(data.expressions);
        const mapped = mapToReactFlowElements(data.nodes, data.edges, normalizedExprs, positions);

        set({
          nodes: mapped.nodes,
          edges: mapped.edges,
          expressions: normalizedExprs,
          isLoading: mapped.nodes.length > 0,
        });

        resetLastSavedState(graphId, mapped.nodes, mapped.edges, normalizedExprs);
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

    flow.nodes.forEach(n => {
      if (n.position) {
        positions[n.id] = n.position as { x: number; y: number };
      }
    });

    const normalizedExprs = normalizeExpressions(flow.expressions);
    const mapped = mapToReactFlowElements(flow.nodes, flow.edges, normalizedExprs, positions);

    runLayout(mapped.nodes, mapped.edges).then(laidOut => {
      set({
        nodes: laidOut.nodes,
        edges: laidOut.edges,
        expressions: normalizedExprs,
      });
    });
  },
});
