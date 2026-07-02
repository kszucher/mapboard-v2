import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
} from '@xyflow/react';
import type { AppFlowNode, AppFlowEdge } from '../components/types';
import type { GraphStoreState } from './types';
import { setOnSaveStateChange, triggerSave } from './helpers';
import { createInitSlice } from './slices/initSlice';
import { createFlowSlice } from './slices/flowSlice';
import { createNodeSlice } from './slices/nodeSlice';
import { createExpressionSlice } from './slices/expressionSlice';
import { createHistorySlice } from './slices/historySlice';

export const useGraphStore = create<GraphStoreState>((set, get, store) => ({
  graphId: null,
  nodes: [],
  edges: [],
  expressions: [],
  past: [],
  future: [],
  isLoading: false,
  isSaving: false,

  ...createInitSlice(set, get, store),
  ...createFlowSlice(set, get, store),

  onNodesChange: (changes) => {
    set((state) => {
      const newNodes = applyNodeChanges(changes, state.nodes);
      return { nodes: newNodes as AppFlowNode[] };
    });
  },

  onEdgesChange: (changes) => {
    set((state) => {
      const newEdges = applyEdgeChanges(changes, state.edges);
      return { edges: newEdges as AppFlowEdge[] };
    });
  },

  onNodeDragStop: () => {
    const { graphId, nodes, edges, expressions } = get();
    triggerSave(graphId, nodes, edges, expressions);
  },

  ...createNodeSlice(set, get, store),
  ...createExpressionSlice(set, get, store),
  ...createHistorySlice(set, get, store),
}));

setOnSaveStateChange((isSaving) => {
  useGraphStore.setState({ isSaving });
});
