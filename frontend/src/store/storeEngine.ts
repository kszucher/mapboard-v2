import { apiClient, getClientId } from '../api/client';
import { queryClient } from '../api/queryClient';
import { queryKeys } from '../api/queryKeys';
import { fromApiPayload, toApiPayload } from './mappers';
import type { components } from '../api/generated/schema';

export const onSaveStateChange: ((isSaving: boolean) => void) | null = null;
export const onSyncResponse: ((data: components['schemas']['GraphFlowRead']) => void) | null = null;

const saveTimeoutsByGraph = new Map<string, number>();
const lastSavedStateByGraph = new Map<string, string>();

export const scheduleAutosave = (graphId: string, newCode: string) => {
  if (!graphId) return;

  const existingTimeout = saveTimeoutsByGraph.get(graphId);
  if (existingTimeout !== undefined) {
    window.clearTimeout(existingTimeout);
  }

  const timeout = window.setTimeout(async () => {
    saveTimeoutsByGraph.delete(graphId);

    // Retrieve visual elements and structures from TanStack Query cache
    const cached = queryClient.getQueryData<components['schemas']['GraphFlowRead']>(queryKeys.graphs.flow(graphId));
    if (!cached) return;

    const mapped = fromApiPayload(cached.nodes, cached.edges);

    const state = {
      graphId,
      code: newCode,
      nodes: mapped.nodes,
      edges: mapped.edges,
      variables: cached.variables || [],
      functions: cached.functions || [],
    };

    const payload = toApiPayload(state);
    const stateStr = JSON.stringify(payload);
    if (stateStr === lastSavedStateByGraph.get(graphId)) {
      return;
    }
    lastSavedStateByGraph.set(graphId, stateStr);

    try {
      onSaveStateChange?.(true);
      const res = await apiClient.PUT('/graphs/{graph_id}/sync', {
        params: { path: { graph_id: graphId } },
        headers: { 'X-Client-Id': getClientId() },
        body: payload,
      });
      if ('error' in res) throw res.error;
      if (res.data) {
        onSyncResponse?.(res.data);
        // Sync newly compiled output back into query cache
        queryClient.setQueryData(queryKeys.graphs.flow(graphId), res.data);
      }
    } catch (err) {
      console.error('Failed to sync graph flow with backend:', err);
    } finally {
      onSaveStateChange?.(false);
    }
  }, 500);

  saveTimeoutsByGraph.set(graphId, timeout);
};
