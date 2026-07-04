import type { StateCreator } from 'zustand';
import type { AppFlowEdge } from '../../components/types';
import { updateFlowState } from '../helpers';
import type { FlowSlice, GraphStoreState } from '../types';

export const createFlowSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  FlowSlice
> = (set, get) => ({
  onConnect: async (connection) => {
    if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) return;

    await updateFlowState(set, get, (state) => {
      const newEdgeId = crypto.randomUUID();
      const newEdge: AppFlowEdge = {
        id: newEdgeId,
        source: connection.source!,
        target: connection.target!,
        sourceHandle: connection.sourceHandle!,
        targetHandle: connection.targetHandle!,
        type: 'custom',
        animated: true,
        style: { opacity: 0 }
      };

      return {
        nodes: state.nodes,
        edges: [...state.edges, newEdge],
        expressions: state.expressions,
      };
    });
  },

  onEdgesDelete: async (edgesToDelete) => {
    await updateFlowState(set, get, (state) => {
      const deleteIds = new Set(edgesToDelete.map(e => e.id));
      return {
        nodes: state.nodes,
        edges: state.edges.filter(e => !deleteIds.has(e.id)),
        expressions: state.expressions,
      };
    });
  },

  onReconnect: async (oldEdge, newConnection) => {
    if (!newConnection.source || !newConnection.target || !newConnection.sourceHandle || !newConnection.targetHandle) return;

    await updateFlowState(set, get, (state) => {
      const updatedEdge: AppFlowEdge = {
        ...oldEdge,
        source: newConnection.source!,
        target: newConnection.target!,
        sourceHandle: newConnection.sourceHandle!,
        targetHandle: newConnection.targetHandle!,
        style: { ...oldEdge.style, opacity: 0 }
      };

      const nextEdges = state.edges.map(e => e.id === oldEdge.id ? updatedEdge : e);
      return {
        nodes: state.nodes,
        edges: nextEdges,
        expressions: state.expressions,
      };
    });
  },
});
