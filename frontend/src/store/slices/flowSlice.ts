import type { Connection, EdgeChange, NodeChange } from '@xyflow/react';
import { applyEdgeChanges, applyNodeChanges } from '@xyflow/react';
import type { StateCreator } from 'zustand';
import type { ApiNode, AppFlowEdge, AppFlowNode } from '../../components/types';
import { runLayout } from '../layout';
import { runTransaction, scheduleAutosave } from '../storeEngine';
import type { FlowSlice, GraphStoreState } from '../types';

export const createFlowSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  FlowSlice
> = (set, get) => ({
  onNodesChange: (changes: NodeChange[]) => {
    const hasSelectChange = changes.some(c => c.type === 'select');
    const meaningfulChanges = changes.filter(c => c.type !== 'select');

    if (meaningfulChanges.length === 0 && !hasSelectChange) return;

    set((state) => {
      let newNodes = applyNodeChanges(changes, state.nodes);
      const selectedNode = newNodes.find(n => n.selected);
      if (selectedNode) {
        newNodes = newNodes.map(n => {
          const isTarget = n.id === selectedNode.id;
          const nodeData = n.data as { node: ApiNode } | undefined;
          const slots = nodeData?.node.slots.map(s => ({ ...s, selected: false })) || [];
          return {
            ...n,
            selected: isTarget,
            data: {
              ...n.data,
              node: {
                ...nodeData?.node,
                selected: isTarget,
                slots,
              }
            }
          };
        });
      } else {
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
      }
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
          scheduleAutosave({
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

          scheduleAutosave({
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

  onEdgesChange: (changes: EdgeChange[]) => {
    set((state) => {
      const newEdges = applyEdgeChanges(changes, state.edges);
      return { edges: newEdges as AppFlowEdge[] };
    });
  },

  onConnect: async (connection: Connection) => {
    if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) return;

    await runTransaction(set, get, (state) => {
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
      };
    });
  },

  onEdgesDelete: async (edgesToDelete: AppFlowEdge[]) => {
    await runTransaction(set, get, (state) => {
      const deleteIds = new Set(edgesToDelete.map(e => e.id));
      return {
        nodes: state.nodes,
        edges: state.edges.filter(e => !deleteIds.has(e.id)),
      };
    });
  },

  onReconnect: async (oldEdge: AppFlowEdge, newConnection: Connection) => {
    if (!newConnection.source || !newConnection.target || !newConnection.sourceHandle || !newConnection.targetHandle) return;

    await runTransaction(set, get, (state) => {
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
      };
    });
  },
});
