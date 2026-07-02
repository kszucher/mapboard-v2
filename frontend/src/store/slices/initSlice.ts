import type { StateCreator } from 'zustand';
import { apiClient } from '../../api/client';
import { mapToReactFlowElements, runLayout } from '../../utils/flowUtils';
import { resetLastSavedState, triggerSave } from '../helpers';
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

        const mapped = mapToReactFlowElements(data.nodes, data.edges, data.expressions, positions);

        const anyPositioned = mapped.nodes.some(n => n.data?.isPositioned);
        let finalNodes = mapped.nodes;
        let finalEdges = mapped.edges;

        if (!anyPositioned && mapped.nodes.length > 0) {
          const laidOut = await runLayout(mapped.nodes, mapped.edges);
          finalNodes = laidOut.nodes;
          finalEdges = laidOut.edges;
          triggerSave(graphId, laidOut.nodes, laidOut.edges, data.expressions);
        } else {
          const laidOut = await runLayout(mapped.nodes, mapped.edges);
          finalNodes = laidOut.nodes;
          finalEdges = laidOut.edges;
        }

        set({
          nodes: finalNodes,
          edges: finalEdges,
          expressions: data.expressions,
        });

        resetLastSavedState(graphId, finalNodes, finalEdges, data.expressions);
      }
    } catch (err) {
      console.error('Failed to initialize graph:', err);
    } finally {
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

    const mapped = mapToReactFlowElements(flow.nodes, flow.edges, flow.expressions, positions);

    runLayout(mapped.nodes, mapped.edges).then(laidOut => {
      set({
        nodes: laidOut.nodes,
        edges: laidOut.edges,
        expressions: flow.expressions,
      });
    });
  },
});
