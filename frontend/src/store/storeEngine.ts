import type { StoreApi } from 'zustand';
import { apiClient, getClientId } from '../api/client';
import type { AppFlowEdge, AppFlowNode, FunctionEntity, Variable } from '../components/types';
import { runLayout } from './layout';
import { toApiPayload } from './mappers';
import type { GraphStoreState } from './types';

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

export const scheduleAutosave = (
  state: Pick<GraphStoreState, 'graphId' | 'code' | 'nodes' | 'edges' | 'variables' | 'functions'>
) => {
  const graphId = state.graphId;
  if (!graphId) return;

  const existingTimeout = saveTimeoutsByGraph.get(graphId);
  if (existingTimeout !== undefined) {
    window.clearTimeout(existingTimeout);
  }

  const timeout = window.setTimeout(async () => {
    saveTimeoutsByGraph.delete(graphId);

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
  state: Pick<GraphStoreState, 'graphId' | 'code' | 'nodes' | 'edges' | 'variables' | 'functions'>
) => {
  if (!state.graphId) return;
  const payload = toApiPayload(state);
  lastSavedStateByGraph.set(state.graphId, JSON.stringify(payload));
};

export const takeSnapshot = (state: Pick<GraphStoreState, 'code' | 'nodes' | 'edges' | 'variables' | 'functions'>) => {
  return structuredClone({
    code: state.code,
    nodes: state.nodes,
    edges: state.edges,
    variables: state.variables,
    functions: state.functions,
  });
};

export const runTransaction = async (
  set: StoreApi<GraphStoreState>['setState'],
  get: StoreApi<GraphStoreState>['getState'],
  updateFn: (state: {
    code: string;
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    variables: Variable[];
    functions: FunctionEntity[];
  }) => {
    code?: string;
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    variables?: Variable[];
    functions?: FunctionEntity[];
  },
  options: { skipHistory?: boolean; skipLayout?: boolean } = {}
) => {
  const current = get();
  const snapshot = options.skipHistory ? null : takeSnapshot(current);
  const updated = updateFn(current);

  const code = updated.code ?? current.code;
  const variables = updated.variables ?? current.variables;
  const functions = updated.functions ?? current.functions;

  // 1. Commit changes to the store synchronously first
  set((state) => ({
    code,
    nodes: updated.nodes,
    edges: updated.edges,
    variables,
    functions,
    ...(!options.skipHistory && snapshot
      ? { past: [...state.past, snapshot], future: [] }
      : {}),
  }));

  // 2. Perform layout/save asynchronously in the background
  let skipLayout = options.skipLayout;
  const nodeWithCountChange = updated.nodes.find(node => {
    const prevNode = current.nodes.find((n: AppFlowNode) => n.id === node.id);
    const prevCount = prevNode ? prevNode.data.node.slots.length : 0;
    const nextCount = node.data.node.slots.length;
    return prevCount !== nextCount;
  });

  if (nodeWithCountChange) {
    set({ pendingLayoutNodeId: nodeWithCountChange.id });
    skipLayout = true;
  }

  if (skipLayout) {
    scheduleAutosave({
      graphId: current.graphId,
      code,
      nodes: updated.nodes,
      edges: updated.edges,
      variables,
      functions,
    });
    return;
  }

  void runLayout(updated.nodes, updated.edges).then((laidOut) => {
    if (get().graphId !== current.graphId) return;

    set({
      nodes: laidOut.nodes,
      edges: laidOut.edges,
    });

    scheduleAutosave({
      graphId: current.graphId,
      code,
      nodes: laidOut.nodes,
      edges: laidOut.edges,
      variables,
      functions,
    });
  });
};
