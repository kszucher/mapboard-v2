import type { StoreApi } from 'zustand';
import { apiClient, getClientId } from '../api/client';
import type { ApiExpression, AppFlowEdge, AppFlowNode } from '../components/types';
import { runLayout } from '../utils/flowUtils';
import type { GraphStoreState } from './types';

let onSaveStateChange: ((isSaving: boolean) => void) | null = null;

export const setOnSaveStateChange = (callback: (isSaving: boolean) => void) => {
  onSaveStateChange = callback;
};

let saveTimeout: number | null = null;
let lastSavedStateStr: string | null = null;

export const triggerSave = (
  graphId: string | null,
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[]
) => {
  if (!graphId) return;

  if (saveTimeout !== null) {
    window.clearTimeout(saveTimeout);
  }

  saveTimeout = window.setTimeout(async () => {
    const nodesPayload = nodes.map(n => ({
      id: n.id,
      graph_id: n.data?.node?.graph_id || graphId,
      iid: n.data?.node?.iid ?? 0,
      label: n.data?.node?.label ?? '',
      is_processing: n.data?.node?.is_processing ?? false,
      node_type: n.data?.node?.node_type ?? 'LOGIC',
      position: n.position,
    }));

    const edgesPayload = edges.map(e => ({
      id: e.id,
      graph_id: graphId,
      from_expression_id: e.sourceHandle || '',
      to_expression_id: e.targetHandle || '',
      from_node_id: e.source,
      to_node_id: e.target,
    }));

    const payload = {
      nodes: nodesPayload,
      edges: edgesPayload,
      expressions,
    };

    const stateStr = JSON.stringify(payload);
    if (stateStr === lastSavedStateStr) {
      return;
    }
    lastSavedStateStr = stateStr;

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
};

export const resetLastSavedState = (
  graphId: string,
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[]
) => {
  const nodesPayload = nodes.map(n => ({
    id: n.id,
    graph_id: n.data?.node?.graph_id || graphId,
    iid: n.data?.node?.iid ?? 0,
    label: n.data?.node?.label ?? '',
    is_processing: n.data?.node?.is_processing ?? false,
    node_type: n.data?.node?.node_type ?? 'LOGIC',
    position: n.position,
  }));

  const edgesPayload = edges.map(e => ({
    id: e.id,
    graph_id: graphId,
    from_expression_id: e.sourceHandle || '',
    to_expression_id: e.targetHandle || '',
    from_node_id: e.source,
    to_node_id: e.target,
  }));

  lastSavedStateStr = JSON.stringify({
    nodes: nodesPayload,
    edges: edgesPayload,
    expressions,
  });
};

export const takeSnapshot = (state: {
  nodes: AppFlowNode[];
  edges: AppFlowEdge[];
  expressions: ApiExpression[];
}) => {
  return {
    nodes: JSON.parse(JSON.stringify(state.nodes)) as AppFlowNode[],
    edges: JSON.parse(JSON.stringify(state.edges)) as AppFlowEdge[],
    expressions: JSON.parse(JSON.stringify(state.expressions)) as ApiExpression[],
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
  }
) => {
  const current = get();
  const snapshot = takeSnapshot(current);
  const updated = updateFn(current);

  const nodesWithDimensions = updated.nodes.map(n => {
    const nodeExpressions = updated.expressions.filter(e => e.node_id === n.id);
    return {
      ...n,
      data: {
        ...n.data,
        expressions: nodeExpressions,
      }
    };
  });

  const laidOut = await runLayout(nodesWithDimensions, updated.edges);

  set((state) => ({
    nodes: laidOut.nodes,
    edges: laidOut.edges,
    expressions: updated.expressions,
    past: [...state.past, snapshot],
    future: [],
  }));

  triggerSave(current.graphId, laidOut.nodes, laidOut.edges, updated.expressions);
};
