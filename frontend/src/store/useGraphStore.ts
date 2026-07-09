import { applyEdgeChanges, applyNodeChanges, } from '@xyflow/react';
import { create } from 'zustand';
import type { AppFlowEdge, AppFlowNode } from '../components/types';
import { runLayout } from '../utils/flowUtils';
import { setOnSaveStateChange, triggerSave, updateFlowState } from './helpers';
import { createFlowSlice } from './slices/flowSlice';
import { createHistorySlice } from './slices/historySlice';
import { createInitSlice } from './slices/initSlice';
import { createNodeSlice } from './slices/nodeSlice';
import { createSlotSlice } from './slices/slotSlice';
import type { GraphStoreState } from './types';

export const useGraphStore = create<GraphStoreState>((set, get, store) => ({
  graphId: null,
  nodes: [],
  edges: [],
  variables: [],
  functions: [],
  past: [],
  future: [],
  isLoading: false,
  isSaving: false,
  errorMessage: null,
  clearErrorMessage: () => set({ errorMessage: null }),
  pendingLayoutNodeId: null,

  addVariable: async (name, type) => {
    await updateFlowState(set, get, (state) => {
      const newVar = {
        id: crypto.randomUUID(),
        name,
        type,
        value: null,
      };
      return {
        ...state,
        variables: [...state.variables, newVar],
      };
    });
  },

  addFunction: async (name, inputVariableId, outputVariableId, rawString) => {
    await updateFlowState(set, get, (state) => {
      const newFunc = {
        id: crypto.randomUUID(),
        name,
        input_variable: inputVariableId,
        output_variable: outputVariableId,
        raw_string: rawString,
      };
      return {
        ...state,
        functions: [...state.functions, newFunc],
      };
    });
  },

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

    const { nodes, edges, graphId, isLoading, pendingLayoutNodeId } = get();
    const hasDimensionsChange = meaningfulChanges.some(c => c.type === 'dimensions');

    if (hasDimensionsChange && pendingLayoutNodeId) {
      const hasTargetNodeDimensionChange = meaningfulChanges.some(
        c => c.type === 'dimensions' && c.id === pendingLayoutNodeId
      );
      if (hasTargetNodeDimensionChange) {
        set({ pendingLayoutNodeId: null });
        void runLayout(nodes, edges).then((laidOut) => {
          set({
            nodes: laidOut.nodes,
            edges: laidOut.edges,
          });
          triggerSave({
            graphId,
            nodes: laidOut.nodes,
            edges: laidOut.edges,
            variables: get().variables,
            functions: get().functions,
          });
        });
      }
    }

    if (hasDimensionsChange && isLoading) {
      const allMeasured = nodes.length > 0 && nodes.every(
        n => n.measured?.width !== undefined && n.measured?.height !== undefined
      );
      if (allMeasured) {
        void runLayout(nodes, edges).then((laidOut) => {
          set({
            nodes: laidOut.nodes,
            edges: laidOut.edges,
            isLoading: false,
          });

          window.setTimeout(() => {
            set((state) => ({
              nodes: state.nodes.map(node => ({
                ...node,
                style: {
                  ...node.style,
                  transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
                }
              }))
            }));
          }, 50);

          triggerSave({
            graphId,
            nodes: laidOut.nodes,
            edges: laidOut.edges,
            variables: get().variables,
            functions: get().functions,
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
  ...createSlotSlice(set, get, store),
  ...createHistorySlice(set, get, store),
}));

setOnSaveStateChange((isSaving) => {
  useGraphStore.setState({ isSaving });
});
