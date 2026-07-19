import { apiClient, getClientId } from '../api/client';
import { queryClient } from '../api/queryClient';
import { toApiPayload } from './mappers';

let onSaveStateChange: ((isSaving: boolean) => void) | null = null;
let onSyncResponse: ((data: any) => void) | null = null;

export const setOnSaveStateChange = (callback: (isSaving: boolean) => void) => {
  onSaveStateChange = callback;
};

export const setOnSyncResponse = (callback: (data: any) => void) => {
  onSyncResponse = callback;
};

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
    const cached = queryClient.getQueryData<any>(['graph', graphId]);
    if (!cached) return;

    const state = {
      graphId,
      code: newCode,
      nodes: cached.nodes || [],
      edges: cached.edges || [],
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
        queryClient.setQueryData(['graph', graphId], res.data);
      }
    } catch (err) {
      console.error('Failed to sync graph flow with backend:', err);
    } finally {
      onSaveStateChange?.(false);
    }
  }, 500);

  saveTimeoutsByGraph.set(graphId, timeout);
};

export const resetLastSavedState = (
  state: {
    graphId: string;
    code: string;
    nodes: any[];
    edges: any[];
    variables: any[];
    functions: any[];
  }
) => {
  if (!state.graphId) return;
  const payload = toApiPayload(state);
  lastSavedStateByGraph.set(state.graphId, JSON.stringify(payload));
};
