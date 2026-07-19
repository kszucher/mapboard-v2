import type { StateCreator } from 'zustand';
import { runLayout } from '../layout';
import type { GraphStoreState, NodeSlice } from '../types';
import { apiClient, getClientId } from '../../api/client';
import { fromApiPayload } from '../mappers';
import { resetLastSavedState } from '../storeEngine';

export const applyGraphFlowUpdate = async (
  set: any,
  get: any,
  data: any
) => {
  const { nodes, graphId } = get();
  const currentPositions = Object.fromEntries(nodes.map((n: any) => [n.id, n.position]));
  const mapped = fromApiPayload(data.nodes, data.edges, currentPositions);

  const laidOut = await runLayout(mapped.nodes, mapped.edges);

  set({
    code: data.code || '',
    nodes: laidOut.nodes,
    edges: laidOut.edges,
    variables: data.variables || [],
    functions: data.functions || [],
    canUndo: data.can_undo ?? false,
    canRedo: data.can_redo ?? false,
    errorMessage: null,
  });

  resetLastSavedState({
    graphId,
    code: data.code || '',
    nodes: laidOut.nodes,
    edges: laidOut.edges,
    variables: data.variables || [],
    functions: data.functions || [],
  });
};

export const createNodeSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  NodeSlice
> = (set, get) => ({
  addNode: async (nodeType) => {
    const { graphId } = get();
    if (!graphId) return;

    try {
      const res = await apiClient.POST('/graphs/{graph_id}/nodes', {
        params: { path: { graph_id: graphId } },
        headers: { 'X-Client-Id': getClientId() },
        body: { node_type: nodeType }
      });
      if ('error' in res) throw res.error;
      if (res.data) {
        await applyGraphFlowUpdate(set, get, res.data);
      }
    } catch (err: any) {
      console.error('Failed to add node:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },

  insertNode: async (connectorId, nodeType, direction) => {
    const { graphId } = get();
    if (!graphId) return;

    try {
      const res = await apiClient.POST('/graphs/{graph_id}/nodes', {
        params: { path: { graph_id: graphId } },
        headers: { 'X-Client-Id': getClientId() },
        body: { node_type: nodeType, connector_id: connectorId, direction }
      });
      if ('error' in res) throw res.error;
      if (res.data) {
        await applyGraphFlowUpdate(set, get, res.data);
      }
    } catch (err: any) {
      console.error('Failed to insert node:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },

  deleteNode: async (nodeId) => {
    const { graphId } = get();
    if (!graphId) return;

    try {
      const res = await apiClient.DELETE('/graphs/{graph_id}/nodes/{node_id}', {
        params: { path: { graph_id: graphId, node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
      if (res.data) {
        await applyGraphFlowUpdate(set, get, res.data);
      }
    } catch (err: any) {
      console.error('Failed to delete node:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },

  shortcircuitNode: async (nodeId) => {
    const { graphId } = get();
    if (!graphId) return;

    try {
      const res = await apiClient.POST('/graphs/{graph_id}/nodes/{node_id}/shortcircuit', {
        params: { path: { graph_id: graphId, node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
      if (res.data) {
        await applyGraphFlowUpdate(set, get, res.data);
      }
    } catch (err: any) {
      console.error('Failed to shortcircuit node:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },

  deleteEdge: async (edgeId) => {
    const { graphId } = get();
    if (!graphId) return;

    try {
      const res = await apiClient.DELETE('/graphs/{graph_id}/edges/{edge_id}', {
        params: { path: { graph_id: graphId, edge_id: edgeId } },
        headers: { 'X-Client-Id': getClientId() },
      });
      if ('error' in res) throw res.error;
      if (res.data) {
        await applyGraphFlowUpdate(set, get, res.data);
      }
    } catch (err: any) {
      console.error('Failed to delete edge:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },

  updateNode: async (nodeId, updates) => {
    // Selection updates are client-side only
    if (updates.selected !== undefined && updates.is_input === undefined && updates.is_output === undefined) {
      set((state) => {
        const nextNodes = state.nodes.map(n => {
          const isTarget = n.id === nodeId;
          const newSelected = isTarget ? !!updates.selected : false;

          // Clear slot selection when selection changes
          const slots = n.data.node.slots.map(s => ({ ...s, selected: false }));

          return {
            ...n,
            selected: newSelected,
            data: {
              ...n.data,
              node: {
                ...n.data.node,
                selected: newSelected,
                slots,
              }
            }
          };
        });
        return { nodes: nextNodes };
      });
      return;
    }

    const { graphId } = get();
    if (!graphId) return;

    try {
      const res = await apiClient.PATCH('/graphs/{graph_id}/nodes/{node_id}', {
        params: { path: { graph_id: graphId, node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
        body: {
          is_input: updates.is_input,
          is_output: updates.is_output,
        }
      });
      if ('error' in res) throw res.error;
      if (res.data) {
        await applyGraphFlowUpdate(set, get, res.data);
      }
    } catch (err: any) {
      console.error('Failed to update node:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },

  setSelectedIds: async (nodeId, branchIndex) => {
    // Purely client-side visual state for nodes and slots
    set((state) => {
      const nextNodes = state.nodes.map(n => {
        const isNodeMatch = n.id === nodeId;
        const isSlotSelection = branchIndex !== null && branchIndex !== -1;
        const isNodeSelected = isNodeMatch && !isSlotSelection;

        const slots = n.data.node.slots.map((s, idx) => ({
          ...s,
          selected: isNodeMatch && isSlotSelection && idx === branchIndex
        }));

        return {
          ...n,
          selected: isNodeSelected,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              selected: isNodeSelected,
              slots
            }
          }
        };
      });

      return {
        nodes: nextNodes,
      };
    });
  },

  renameNode: async (nodeId, newId) => {
    const { graphId } = get();
    if (!graphId) return;

    try {
      const res = await apiClient.PATCH('/graphs/{graph_id}/nodes/{node_id}', {
        params: { path: { graph_id: graphId, node_id: nodeId } },
        headers: { 'X-Client-Id': getClientId() },
        body: { new_id: newId }
      });
      if ('error' in res) throw res.error;
      if (res.data) {
        await applyGraphFlowUpdate(set, get, res.data);
      }
    } catch (err: any) {
      console.error('Failed to rename node:', err);
      set({ errorMessage: err.detail || String(err) });
    }
  },
});
