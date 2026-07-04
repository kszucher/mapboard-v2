import type { StateCreator } from 'zustand';
import type { AppFlowEdge } from '../../components/types';
import {
  createNewNode,
  getPrimaryInputExprId,
  getPrimaryOutputExprId,
  updateNodeNodeType,
} from '../../utils/flowUtils';
import { updateFlowState } from '../helpers';
import type { GraphStoreState, NodeSlice } from '../types';

export const createNodeSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  NodeSlice
> = (set, get) => ({
  addNode: async (nodeType) => {
    const { graphId } = get();
    if (!graphId) return;

    await updateFlowState(set, get, (state) => {
      const { appNode, defaultExprs } = createNewNode(graphId, nodeType, state.nodes);

      return {
        nodes: [...state.nodes, appNode],
        edges: state.edges,
        expressions: [...state.expressions, ...defaultExprs],
      };
    });
  },

  addConnectedNode: async (expressionId, nodeType) => {
    const { graphId } = get();
    if (!graphId) return;

    await updateFlowState(set, get, (state) => {
      const exists = state.edges.some(e => e.sourceHandle === expressionId);
      if (exists) {
        alert('Expression is already connected to another node.');
        return state;
      }

      const { appNode, defaultExprs } = createNewNode(graphId, nodeType, state.nodes);
      const toExprId = getPrimaryInputExprId(defaultExprs);

      const newEdgeId = crypto.randomUUID();
      const fromNodeId = state.expressions.find(e => e.id === expressionId)?.node_id || '';

      const newEdge: AppFlowEdge = {
        id: newEdgeId,
        source: fromNodeId,
        target: appNode.id,
        sourceHandle: expressionId,
        targetHandle: toExprId,
        type: 'custom',
        animated: true,
        style: { opacity: 0 }
      };

      return {
        nodes: [...state.nodes, appNode],
        edges: [...state.edges, newEdge],
        expressions: [...state.expressions, ...defaultExprs],
      };
    });
  },

  insertNodeBetween: async (expressionId, nodeType) => {
    const { graphId } = get();
    if (!graphId) return;

    await updateFlowState(set, get, (state) => {
      const oldEdgeIndex = state.edges.findIndex(e => e.sourceHandle === expressionId);
      if (oldEdgeIndex === -1) return state;

      const oldEdge = state.edges[oldEdgeIndex];
      const targetNodeId = oldEdge.target;
      const targetHandle = oldEdge.targetHandle;

      const { appNode, defaultExprs } = createNewNode(graphId, nodeType, state.nodes);
      const toExprId = getPrimaryInputExprId(defaultExprs);
      const fromExprId = getPrimaryOutputExprId(defaultExprs);

      const updatedOldEdge: AppFlowEdge = {
        ...oldEdge,
        target: appNode.id,
        targetHandle: toExprId,
      };

      const newEdge: AppFlowEdge = {
        id: crypto.randomUUID(),
        source: appNode.id,
        target: targetNodeId,
        sourceHandle: fromExprId,
        targetHandle,
        type: 'custom',
        animated: true,
        style: { opacity: 0 }
      };

      const nextEdges = [...state.edges];
      nextEdges[oldEdgeIndex] = updatedOldEdge;
      nextEdges.push(newEdge);

      return {
        nodes: [...state.nodes, appNode],
        edges: nextEdges,
        expressions: [...state.expressions, ...defaultExprs],
      };
    });
  },

  deleteNode: async (nodeId) => {
    await updateFlowState(set, get, (state) => {
      const exprIds = new Set(state.expressions.filter(e => e.node_id === nodeId).map(e => e.id));
      const nextNodes = state.nodes.filter(n => n.id !== nodeId);
      const nextEdges = state.edges.filter(e =>
        e.source !== nodeId &&
        e.target !== nodeId &&
        !exprIds.has(e.sourceHandle || '') &&
        !exprIds.has(e.targetHandle || '')
      );
      const nextExpressions = state.expressions.filter(e => e.node_id !== nodeId);

      return {
        nodes: nextNodes,
        edges: nextEdges,
        expressions: nextExpressions,
      };
    });
  },

  shortcircuitNode: async (nodeId) => {
    const node = get().nodes.find(n => n.id === nodeId);
    if (!node) return;

    const nodeType = node.data?.node?.node_type;
    if (!nodeType || nodeType === 'START' || nodeType === 'END') return;

    const nodeExprs = get().expressions.filter(e => e.node_id === nodeId);
    const inputs = nodeExprs.filter(e => e.is_input);
    const outputs = nodeExprs.filter(e => e.is_output);
    if (inputs.length !== 1 || outputs.length !== 1) {
      set({ errorMessage: 'Can only shortcircuit nodes with exactly one input and one output expression.' });
      return;
    }

    await updateFlowState(set, get, (state) => {
      const nodeExprIds = new Set(nodeExprs.map(e => e.id));
      const incoming = state.edges.filter(e => nodeExprIds.has(e.targetHandle || ''));
      const outgoing = state.edges.filter(e => nodeExprIds.has(e.sourceHandle || ''));

      let nextEdges = state.edges.filter(e => !nodeExprIds.has(e.sourceHandle || '') && !nodeExprIds.has(e.targetHandle || ''));

      if (incoming.length > 0 && outgoing.length > 0) {
        const sortedOutgoing = [...outgoing].sort((a, b) => a.id.localeCompare(b.id));
        const primaryTargetHandle = sortedOutgoing[0].targetHandle;
        const primaryTargetNode = sortedOutgoing[0].target;

        const reRoutedIncoming: AppFlowEdge[] = incoming.map(e => ({
          ...e,
          target: primaryTargetNode,
          targetHandle: primaryTargetHandle,
        }));

        nextEdges = [...nextEdges, ...reRoutedIncoming];
      }

      return {
        nodes: state.nodes.filter(n => n.id !== nodeId),
        edges: nextEdges,
        expressions: state.expressions.filter(e => e.node_id !== nodeId),
      };
    });
  },

  convertNode: async (nodeId, targetType) => {
    await updateFlowState(set, get, (state) => {
      const nodeIndex = state.nodes.findIndex(n => n.id === nodeId);
      if (nodeIndex === -1) return state;
      const node = state.nodes[nodeIndex];
      const currentType = node.data?.node?.node_type;
      if (!currentType || currentType === targetType) return state;

      const updatedNode = updateNodeNodeType(node, targetType);
      const nextNodes = [...state.nodes];
      nextNodes[nodeIndex] = updatedNode;

      return {
        nodes: nextNodes,
        edges: state.edges,
        expressions: state.expressions,
      };
    });
  },
});
