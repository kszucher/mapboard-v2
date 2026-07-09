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
  state: Pick<GraphStoreState, 'graphId' | 'nodes' | 'edges' | 'expressions'>
) => {
  const graphId = state.graphId || '';
  return {
    nodes: state.nodes.map(n => ({
      ...n.data.node,
    })),
    edges: state.edges.map(e => ({
      id: e.id,
      graph_id: graphId,
      from_expression_id: e.sourceHandle || '',
      to_expression_id: e.targetHandle || '',
      from_node_id: e.source,
      to_node_id: e.target,
    })),
    expressions: state.expressions,
  };
};

export const triggerSave = (
  state: Pick<GraphStoreState, 'graphId' | 'nodes' | 'edges' | 'expressions'>
) => {
  const graphId = state.graphId;
  if (!graphId) return;

  const existingTimeout = saveTimeoutsByGraph.get(graphId);
  if (existingTimeout !== undefined) {
    window.clearTimeout(existingTimeout);
  }

  const timeout = window.setTimeout(async () => {
    saveTimeoutsByGraph.delete(graphId);

    const payload = serializeFlowState(state);
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
  state: Pick<GraphStoreState, 'graphId' | 'nodes' | 'edges' | 'expressions'>
) => {
  if (!state.graphId) return;
  const payload = serializeFlowState(state);
  lastSavedStateByGraph.set(state.graphId, JSON.stringify(payload));
};

export const takeSnapshot = (state: Pick<GraphStoreState, 'nodes' | 'edges' | 'expressions'>) => {
  return structuredClone({
    nodes: state.nodes,
    edges: state.edges,
    expressions: state.expressions,
  });
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
  options: { skipHistory?: boolean; skipLayout?: boolean } = {}
) => {
  const current = get();
  const snapshot = options.skipHistory ? null : takeSnapshot(current);
  const updated = updateFn(current);

  const normalizedExprs = normalizeExpressions(updated.expressions);

  // Auto-detect if any node had expressions added or deleted
  let skipLayout = options.skipLayout;
  const currentExprs = current.expressions;
  const nextExprs = normalizedExprs;

  const nodeWithCountChange = updated.nodes.find(node => {
    const prevCount = currentExprs.filter(e => e.node_id === node.id).length;
    const nextCount = nextExprs.filter(e => e.node_id === node.id).length;
    return prevCount !== nextCount;
  });

  if (nodeWithCountChange) {
    set({ pendingLayoutNodeId: nodeWithCountChange.id });
    skipLayout = true;
  }

  if (skipLayout) {
    set((state) => ({
      nodes: updated.nodes,
      edges: updated.edges,
      expressions: normalizedExprs,
      ...(!options.skipHistory && snapshot
        ? { past: [...state.past, snapshot], future: [] }
        : {}),
    }));
    return;
  }

  if (options.skipHistory) {
    set({ expressions: normalizedExprs });
  }

  const laidOut = await runLayout(updated.nodes, updated.edges, normalizedExprs);

  set((state) => ({
    nodes: laidOut.nodes,
    edges: laidOut.edges,
    expressions: normalizedExprs,
    ...(!options.skipHistory && snapshot
      ? { past: [...state.past, snapshot], future: [] }
      : {}),
  }));

  triggerSave({
    graphId: current.graphId,
    nodes: laidOut.nodes,
    edges: laidOut.edges,
    expressions: normalizedExprs,
  });
};
