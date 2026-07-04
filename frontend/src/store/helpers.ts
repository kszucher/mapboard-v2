import type { StoreApi } from 'zustand';
import { apiClient, getClientId } from '../api/client';
import type { ApiExpression, AppFlowEdge, AppFlowNode } from '../components/types';
import { normalizeExpressions, runLayout } from '../utils/flowUtils';
import type { GraphStoreState } from './types';

let onSaveStateChange: ((isSaving: boolean) => void) | null = null;

export const setOnSaveStateChange = (callback: (isSaving: boolean) => void) => {
  onSaveStateChange = callback;
};

const saveTimeoutsByGraph = new Map<string, number>();
const lastSavedStateByGraph = new Map<string, string>();

export const serializeFlowState = (
  graphId: string,
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[]
) => ({
  nodes: nodes.map(n => ({
    id: n.id,
    graph_id: n.data?.node?.graph_id || graphId,
    iid: n.data?.node?.iid ?? 0,
    label: n.data?.node?.label ?? '',
    is_processing: n.data?.node?.is_processing ?? false,
    node_type: n.data?.node?.node_type ?? 'LOGIC',
    position: n.position,
  })),
  edges: edges.map(e => ({
    id: e.id,
    graph_id: graphId,
    from_expression_id: e.sourceHandle || '',
    to_expression_id: e.targetHandle || '',
    from_node_id: e.source,
    to_node_id: e.target,
  })),
  expressions,
});

export const triggerSave = (
  graphId: string | null,
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[]
) => {
  if (!graphId) return;

  const existingTimeout = saveTimeoutsByGraph.get(graphId);
  if (existingTimeout !== undefined) {
    window.clearTimeout(existingTimeout);
  }

  const timeout = window.setTimeout(async () => {
    saveTimeoutsByGraph.delete(graphId);

    const payload = serializeFlowState(graphId, nodes, edges, expressions);
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
    } catch (err) {
      console.error('Failed to sync graph flow with backend:', err);
    } finally {
      onSaveStateChange?.(false);
    }
  }, 500);

  saveTimeoutsByGraph.set(graphId, timeout);
};

export const resetLastSavedState = (
  graphId: string,
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[]
) => {
  const payload = serializeFlowState(graphId, nodes, edges, expressions);
  lastSavedStateByGraph.set(graphId, JSON.stringify(payload));
};

export const takeSnapshot = (state: {
  nodes: AppFlowNode[];
  edges: AppFlowEdge[];
  expressions: ApiExpression[];
}) => {
  return {
    nodes: structuredClone(state.nodes),
    edges: structuredClone(state.edges),
    expressions: structuredClone(state.expressions),
  };
};

export const updateFlowState = async (
  set: StoreApi<GraphStoreState>['setState'],
  get: StoreApi<GraphStoreState>['getState'],
  updateFn: (state: {
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    expressions: ApiExpression[];
  }) => {
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    expressions: ApiExpression[];
  },
  options: { skipHistory?: boolean } = {}
) => {
  const current = get();
  const snapshot = options.skipHistory ? null : takeSnapshot(current);
  const updated = updateFn(current);

  const normalizedExprs = normalizeExpressions(updated.expressions);

  if (options.skipHistory) {
    set({ expressions: normalizedExprs });
  }

  const laidOut = await runLayout(updated.nodes, updated.edges, normalizedExprs);

  set((state) => ({
    nodes: laidOut.nodes,
    edges: laidOut.edges,
    expressions: normalizedExprs,
    ...(!options.skipHistory && snapshot
      ? {
          past: [...state.past, snapshot],
          future: [],
        }
      : {}),
  }));

  triggerSave(current.graphId, laidOut.nodes, laidOut.edges, normalizedExprs);
};
