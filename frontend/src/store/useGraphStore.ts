import { applyEdgeChanges, applyNodeChanges, } from '@xyflow/react';
import { create } from 'zustand';
import type { AppFlowEdge, AppFlowNode } from '../components/types';
import { runLayout } from '../utils/flowUtils';
import { setOnSaveStateChange, triggerSave } from './helpers';
import { createExpressionSlice } from './slices/expressionSlice';
import { createFlowSlice } from './slices/flowSlice';
import { createHistorySlice } from './slices/historySlice';
import { createInitSlice } from './slices/initSlice';
import { createNodeSlice } from './slices/nodeSlice';
import type { GraphStoreState } from './types';

export const useGraphStore = create<GraphStoreState>((set, get, store) => ({
  graphId: null,
  nodes: [],
  edges: [],
  expressions: [],
  past: [],
  future: [],
  isLoading: false,
  isSaving: false,
  errorMessage: null,
  clearErrorMessage: () => set({ errorMessage: null }),
  pendingLayoutNodeId: null,

  ...createInitSlice(set, get, store),
  ...createFlowSlice(set, get, store),

  onNodesChange: (changes) => {

    // Skip 'select' changes: they're a no-op for us but would still create a new
    // `nodes` reference, which triggers a full edge geometry recompute in xyflow
    // and resets/stutters every edge's flow animation on click.
    const meaningfulChanges = changes.filter(c => c.type !== 'select');
    if (meaningfulChanges.length === 0) return; // no-op click: skip the set() entirely

    set((state) => {
      const newNodes = applyNodeChanges(meaningfulChanges, state.nodes);
      return { nodes: newNodes as AppFlowNode[] };
    });

    const { nodes, edges, graphId, isLoading, expressions, pendingLayoutNodeId } = get();
    const hasDimensionsChange = meaningfulChanges.some(c => c.type === 'dimensions');

    if (hasDimensionsChange && pendingLayoutNodeId) {
      const hasTargetNodeDimensionChange = meaningfulChanges.some(
        c => c.type === 'dimensions' && c.id === pendingLayoutNodeId
      );
      if (hasTargetNodeDimensionChange) {
        set({ pendingLayoutNodeId: null });
        void runLayout(nodes, edges, expressions).then((laidOut) => {
          set({
            nodes: laidOut.nodes,
            edges: laidOut.edges,
          });
          triggerSave({
            graphId,
            nodes: laidOut.nodes,
            edges: laidOut.edges,
            expressions,
          });
        });
      }
    }

    if (hasDimensionsChange && isLoading) {
      const allMeasured = nodes.length > 0 && nodes.every(
        n => n.measured?.width !== undefined && n.measured?.height !== undefined
      );
      if (allMeasured) {
        void runLayout(nodes, edges, expressions).then((laidOut) => {
          set({
            nodes: laidOut.nodes,
            edges: laidOut.edges,
            isLoading: false,
          });
          triggerSave({
            graphId,
            nodes: laidOut.nodes,
            edges: laidOut.edges,
            expressions,
          });
        });
      }
    }
  },

  onEdgesChange: (changes) => {
    set((state) => {
      const newEdges = applyEdgeChanges(changes, state.edges);
      return { edges: newEdges as AppFlowEdge[] };
    });
  },

  ...createNodeSlice(set, get, store),
  ...createExpressionSlice(set, get, store),
  ...createHistorySlice(set, get, store),
}));

setOnSaveStateChange((isSaving) => {
  useGraphStore.setState({ isSaving });
});
