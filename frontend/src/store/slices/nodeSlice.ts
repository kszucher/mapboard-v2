import type { StateCreator } from 'zustand';
import type { AppFlowEdge } from '../../components/types';
import {
  createNewNode,
  getPrimaryInputHandleId,
  getPrimaryOutputHandleId,
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
    await updateFlowState(set, get, (state) => {
      const appNode = createNewNode(nodeType);

      return {
        nodes: [...state.nodes, appNode],
        edges: state.edges,
      };
    });
  },

  insertNode: async (connectorId, nodeType, direction) => {
    await updateFlowState(set, get, (state) => {
      const isAfter = direction === 'after';
      const oldEdges = state.edges.filter(e => isAfter ? e.sourceHandle === connectorId : e.targetHandle === connectorId);

      const appNode = createNewNode(nodeType);
      const toSlotId = getPrimaryInputHandleId(appNode.data.node);
      const fromSlotId = getPrimaryOutputHandleId(appNode.data.node);

      let targetOrSourceNode = state.nodes.find(n => n.id === connectorId);
      if (!targetOrSourceNode) {
        targetOrSourceNode = state.nodes.find(n => n.data.node.slots.some(s => s.id === connectorId));
      }
      const targetOrSourceNodeId = targetOrSourceNode ? targetOrSourceNode.id : '';

      const newEdge: AppFlowEdge = {
        id: crypto.randomUUID(),
        source: isAfter ? targetOrSourceNodeId : appNode.id,
        target: isAfter ? appNode.id : targetOrSourceNodeId,
        sourceHandle: isAfter ? connectorId : fromSlotId,
        targetHandle: isAfter ? toSlotId : connectorId,
        type: 'custom',
        animated: true,
        style: { opacity: 0 }
      };

      const updatedOldEdges = oldEdges.map(oldEdge => ({
        ...oldEdge,
        ...(isAfter ? {
          source: appNode.id,
          sourceHandle: fromSlotId,
        } : {
          target: appNode.id,
          targetHandle: toSlotId,
        })
      }));

      const oldEdgeIds = new Set(oldEdges.map(e => e.id));
      const nextEdges = state.edges.filter(e => !oldEdgeIds.has(e.id));
      nextEdges.push(newEdge);
      nextEdges.push(...updatedOldEdges);

      return {
        nodes: [...state.nodes, appNode],
        edges: nextEdges,
      };
    });
  },

  deleteNode: async (nodeId) => {
    await updateFlowState(set, get, (state) => {
      const node = state.nodes.find(n => n.id === nodeId);
      const slotIds = new Set(node ? node.data.node.slots.map(s => s.id) : []);
      const nextNodes = state.nodes.filter(n => n.id !== nodeId);
      const nextEdges = state.edges.filter(e =>
        e.source !== nodeId &&
        e.target !== nodeId &&
        !slotIds.has(e.sourceHandle || '') &&
        !slotIds.has(e.targetHandle || '')
      );

      return {
        nodes: nextNodes,
        edges: nextEdges,
      };
    });
  },

  shortcircuitNode: async (nodeId) => {
    const node = get().nodes.find(n => n.id === nodeId);
    if (!node) return;

    const nodeType = node.data?.node?.node_type;
    if (nodeType !== 'STEP') {
      set({ errorMessage: 'Can only shortcircuit step nodes.' });
      return;
    }

    await updateFlowState(set, get, (state) => {
      const incoming = state.edges.filter(e => e.target === nodeId);
      const outgoing = state.edges.filter(e => e.source === nodeId);

      let nextEdges = state.edges.filter(e => e.source !== nodeId && e.target !== nodeId);

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
      };
    });
  },

  deleteEdge: async (edgeId) => {
    await updateFlowState(set, get, (state) => {
      const nextEdges = state.edges.filter(e => e.id !== edgeId);
      return {
        nodes: state.nodes,
        edges: nextEdges,
      };
    });
  },

  updateNode: async (nodeId, updates) => {
    await updateFlowState(set, get, (state) => {
      const nextNodes = state.nodes.map(n => {
        if (n.id !== nodeId) return n;
        return {
          ...n,
          selected: updates.selected !== undefined ? updates.selected : n.selected,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              ...updates,
            }
          }
        };
      });

      let nextEdges = state.edges;
      if (updates.is_input === false) {
        nextEdges = nextEdges.filter(e => !(e.target === nodeId && e.targetHandle === nodeId));
      }
      if (updates.is_output === false) {
        nextEdges = nextEdges.filter(e => !(e.source === nodeId && e.sourceHandle === nodeId));
      }

      return {
        nodes: nextNodes,
        edges: nextEdges,
      };
    });
  },
});
