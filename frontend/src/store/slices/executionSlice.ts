import type { StateCreator } from 'zustand';
import { apiClient } from '../../api/client';
import { runLayout } from '../layout';
import { fromApiPayload, toApiPayload } from '../mappers';
import type { ExecutionSlice, GraphStoreState } from '../types';

export const createExecutionSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  ExecutionSlice
> = (set, get) => ({
  updateCode: async (newCode: string) => {
    const { graphId, nodes } = get();
    if (!graphId) return;

    try {
      set({ isLoading: true });
      const payload = toApiPayload({
        graphId,
        code: newCode,
        nodes: get().nodes,
        edges: get().edges,
        variables: get().variables,
        functions: get().functions,
      });

      const res = await apiClient.PUT('/graphs/{graph_id}/sync', {
        params: { path: { graph_id: graphId } },
        body: payload
      });
      if ('error' in res) throw res.error;

      const data = res.data;
      if (data) {
        const positions: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          positions[n.id] = n.position;
        });

        const mapped = fromApiPayload(data.nodes, data.edges, positions);
        const laidOut = await runLayout(mapped.nodes, mapped.edges);

        set({
          code: data.code || newCode,
          nodes: laidOut.nodes,
          edges: laidOut.edges,
          variables: data.variables || [],
          functions: data.functions || [],
          errorMessage: null,
        });
      }
    } catch (err: any) {
      console.error('Failed to sync code with backend:', err);
      const detail = err.detail || String(err);
      set({ errorMessage: detail });
      throw new Error(detail);
    } finally {
      set({ isLoading: false });
    }
  },

  runGraph: async () => {
    const { graphId } = get();
    if (!graphId) return;

    try {
      set({ isLoading: true });
      const res = await (apiClient as any).POST('/graphs/{graph_id}/run', {
        params: { path: { graph_id: graphId } }
      });
      if ('error' in res) throw res.error;

      const data = res.data;
      if (data && data.variables) {
        set({ variables: data.variables });
      }
    } catch (err: any) {
      console.error('Failed to run graph:', err);
      set({ errorMessage: err.detail || String(err) });
    } finally {
      set({ isLoading: false });
    }
  },
});
