import { applyEdgeChanges, applyNodeChanges, } from '@xyflow/react';
import { create } from 'zustand';
import { apiClient } from '../api/client';
import type { ApiNode, AppFlowEdge, AppFlowNode } from '../components/types';
import { mapToReactFlowElements, runLayout } from '../utils/flowUtils';
import { setOnSaveStateChange, triggerSave, updateFlowState } from './helpers';
import { createFlowSlice } from './slices/flowSlice';
import { createHistorySlice } from './slices/historySlice';
import { createInitSlice } from './slices/initSlice';
import { createNodeSlice } from './slices/nodeSlice';
import { createSlotSlice } from './slices/slotSlice';
import type { GraphStoreState } from './types';

export const useGraphStore = create<GraphStoreState>((set, get, store) => ({
  graphId: null,
  code: '',
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

  updateCode: async (newCode) => {
    const { graphId, nodes } = get();
    if (!graphId) return;

    try {
      set({ isLoading: true });
      const res = await apiClient.PUT('/graphs/{graph_id}/sync', {
        params: { path: { graph_id: graphId } },
        body: {
          code: newCode,
          nodes: [],
          edges: [],
          variables: [],
          functions: []
        }
      });
      if ('error' in res) throw res.error;

      const data = res.data;
      if (data) {
        const positions: Record<string, { x: number; y: number }> = {};
        nodes.forEach((n) => {
          positions[n.id] = n.position;
        });

        const mapped = mapToReactFlowElements(data.nodes, data.edges, positions);
        const laidOut = await runLayout(mapped.nodes, mapped.edges);

        set({
          code: data.code || newCode,
          nodes: laidOut.nodes,
          edges: laidOut.edges,
          variables: data.variables || [],
          functions: data.functions || [],
          errorMessage: null,
        });
      }
    } catch (err: any) {
      console.error('Failed to sync code with backend:', err);
      const detail = err.detail || String(err);
      set({ errorMessage: detail });
      throw new Error(detail);
    } finally {
      set({ isLoading: false });
    }
  },

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

  deleteFunction: async (functionId) => {
    await updateFlowState(set, get, (state) => {
      const nextFunctions = state.functions.filter(f => f.id !== functionId);

      return {
        ...state,
        functions: nextFunctions,
      };
    });
  },

  runGraph: async () => {
    const { graphId } = get();
    if (!graphId) return;

    try {
      set({ isLoading: true });
      const res = await (apiClient as any).POST('/graphs/{graph_id}/run', {
        params: { path: { graph_id: graphId } }
      });
      if ('error' in res) throw res.error;

      const data = res.data;
      if (data && data.variables) {
        set({ variables: data.variables });
      }
    } catch (err: any) {
      console.error('Failed to run graph:', err);
      set({ errorMessage: err.detail || String(err) });
    } finally {
      set({ isLoading: false });
    }
  },

  ...createInitSlice(set, get, store),
  ...createFlowSlice(set, get, store),

  onNodesChange: (changes) => {
    const hasSelectChange = changes.some(c => c.type === 'select');
    const meaningfulChanges = changes.filter(c => c.type !== 'select');

    if (meaningfulChanges.length === 0 && !hasSelectChange) return;

    set((state) => {
      let newNodes = applyNodeChanges(changes, state.nodes);
      newNodes = newNodes.map(n => {
        const nodeData = n.data as { node: ApiNode } | undefined;
        if (nodeData?.node && nodeData.node.selected !== n.selected) {
          return {
            ...n,
            data: {
              ...n.data,
              node: {
                ...nodeData.node,
                selected: n.selected,
              }
            }
          };
        }
        return n;
      });
      return { nodes: newNodes as AppFlowNode[] };
    });

    const { nodes, edges, graphId, isLoading, pendingLayoutNodeId } = get();

    if (hasSelectChange) {
      triggerSave({
        graphId,
        code: get().code,
        nodes,
        edges,
        variables: get().variables,
        functions: get().functions,
      });
    }

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
            code: get().code,
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
            code: get().code,
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
