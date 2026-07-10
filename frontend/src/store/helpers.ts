import type { StoreApi } from 'zustand';
import { apiClient, getClientId } from '../api/client';
import type { AppFlowEdge, AppFlowNode, FunctionEntity, Variable } from '../components/types';
import { runLayout } from '../utils/flowUtils';
import type { GraphStoreState } from './types';

let onSaveStateChange: ((isSaving: boolean) => void) | null = null;

export const setOnSaveStateChange = (callback: (isSaving: boolean) => void) => {
  onSaveStateChange = callback;
};

const saveTimeoutsByGraph = new Map<string, number>();
const lastSavedStateByGraph = new Map<string, string>();

export const serializeFlowState = (
  state: Pick<GraphStoreState, 'graphId' | 'nodes' | 'edges' | 'variables' | 'functions'>
) => {
  return {
    nodes: state.nodes.map(n => ({
      id: n.data.node.id,
      node_type: n.data.node.node_type,
      slots: n.data.node.slots.map(s => ({
        id: s.id,
        is_input: s.is_input,
        is_output: s.is_output,
        raw_string: s.raw_string,
        function_id: s.function_id,
        indent: s.indent ?? 0,
      })),
    })),
    edges: state.edges.map(e => ({
      id: e.id,
      from_slot_id: e.sourceHandle || '',
      to_slot_id: e.targetHandle || '',
    })),
    variables: state.variables.map(v => ({
      id: v.id,
      name: v.name,
      type: v.type,
      value: v.value,
    })),
    functions: state.functions.map(f => ({
      id: f.id,
      name: f.name,
      input_variable: f.input_variable,
      output_variable: f.output_variable,
      raw_string: f.raw_string,
    })),
  };
};

export const triggerSave = (
  state: Pick<GraphStoreState, 'graphId' | 'nodes' | 'edges' | 'variables' | 'functions'>
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
  state: Pick<GraphStoreState, 'graphId' | 'nodes' | 'edges' | 'variables' | 'functions'>
) => {
  if (!state.graphId) return;
  const payload = serializeFlowState(state);
  lastSavedStateByGraph.set(state.graphId, JSON.stringify(payload));
};

export const takeSnapshot = (state: Pick<GraphStoreState, 'nodes' | 'edges' | 'variables' | 'functions'>) => {
  return structuredClone({
    nodes: state.nodes,
    edges: state.edges,
    variables: state.variables,
    functions: state.functions,
  });
};

export const updateFlowState = async (
  set: StoreApi<GraphStoreState>['setState'],
  get: StoreApi<GraphStoreState>['getState'],
  updateFn: (state: {
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    variables: Variable[];
    functions: FunctionEntity[];
  }) => {
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

  const variables = updated.variables ?? current.variables;
  const functions = updated.functions ?? current.functions;

  // Auto-detect if any node had slots added or deleted
  let skipLayout = options.skipLayout;

  const nodeWithCountChange = updated.nodes.find(node => {
    const prevNode = current.nodes.find(n => n.id === node.id);
    const prevCount = prevNode ? prevNode.data.node.slots.length : 0;
    const nextCount = node.data.node.slots.length;
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
      variables,
      functions,
      ...(!options.skipHistory && snapshot
        ? { past: [...state.past, snapshot], future: [] }
        : {}),
    }));
    return;
  }

  const laidOut = await runLayout(updated.nodes, updated.edges);

  set((state) => ({
    nodes: laidOut.nodes,
    edges: laidOut.edges,
    variables,
    functions,
    ...(!options.skipHistory && snapshot
      ? { past: [...state.past, snapshot], future: [] }
      : {}),
  }));

  triggerSave({
    graphId: current.graphId,
    nodes: laidOut.nodes,
    edges: laidOut.edges,
    variables,
    functions,
  });
};
