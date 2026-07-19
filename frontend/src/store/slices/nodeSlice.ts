import type { StateCreator } from 'zustand';
import type { ApiNode, AppFlowEdge, AppFlowNode, NodeType } from '../../components/types';
import { createDefaultSlotsForNode } from '../../domain/graphs/rules';
import { runTransaction } from '../storeEngine';
import type { GraphStoreState, NodeSlice } from '../types';
import { apiClient, getClientId } from '../../api/client';



export const createNodeSlice: StateCreator<
  GraphStoreState,
  [],
  [],
  NodeSlice
> = (set, get) => ({
  addNode: async (nodeType) => {
    await runTransaction(set, get, (state) => {
      const appNode = createNewNode(nodeType, state.nodes);

      return {
        nodes: [...state.nodes, appNode],
        edges: state.edges,
      };
    });
  },

  insertNode: async (connectorId, nodeType, direction) => {
    await runTransaction(set, get, (state) => {
      const isAfter = direction === 'after';
      const oldEdges = state.edges.filter(e => isAfter ? e.sourceHandle === connectorId : e.targetHandle === connectorId);

      const appNode = createNewNode(nodeType, state.nodes);
      const toSlotId = appNode.id;
      const fromSlotId = (nodeType === 'SWITCH' && appNode.data.node.slots.length > 0)
        ? appNode.data.node.slots[0].id
        : appNode.id;

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
    await runTransaction(set, get, (state) => {
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

    await runTransaction(set, get, (state) => {
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
    await runTransaction(set, get, (state) => {
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
    await runTransaction(set, get, (state) => {
      const nextEdges = state.edges.filter(e => e.id !== edgeId);
      return {
        nodes: state.nodes,
        edges: nextEdges,
      };
    });
  },

  updateNode: async (nodeId, updates) => {
    const shouldSkipHistory = updates.selected !== undefined;
    await runTransaction(set, get, (state) => {
      const shouldClearOthers = updates.selected === true;
      const nextNodes = state.nodes.map(n => {
        const isTarget = n.id === nodeId;
        const newSelected = isTarget
          ? (updates.selected !== undefined ? updates.selected : (n.selected ?? false))
          : (shouldClearOthers ? false : (n.selected ?? false));

        const slots = n.data.node.slots.map(s => {
          if (shouldClearOthers) {
            return { ...s, selected: false };
          }
          return s;
        });

        return {
          ...n,
          selected: newSelected,
          data: {
            ...n.data,
            node: {
              ...n.data.node,
              ...updates,
              selected: newSelected,
              slots,
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
    }, { skipHistory: shouldSkipHistory });
  },

  setSelectedIds: async (nodeId, branchIndex) => {
    await runTransaction(set, get, (state) => {
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
        edges: state.edges,
      };
    }, { skipHistory: true, skipLayout: true });
  },

  renameNode: async (nodeId, newId) => {
    const { graphId, nodes, edges } = get();
    if (!graphId) return;

    try {
      set({ isLoading: true });
      const res = await apiClient.POST('/graphs/{graph_id}/rename-node', {
        params: { path: { graph_id: graphId } },
        headers: { 'X-Client-Id': getClientId() },
        body: { old_id: nodeId, new_id: newId }
      });
      if ('error' in res) throw res.error;

      const data = res.data;
      if (data) {
        // 1. Rename the nodes in place to keep positions & styles
        const nextNodes = nodes.map((n) => {
          if (n.id === nodeId) {
            return {
              ...n,
              id: newId,
              data: {
                ...n.data,
                node: {
                  ...n.data.node,
                  id: newId,
                },
              },
            };
          }
          return n;
        });

        // 2. Rename edge references in place
        const nextEdges = edges.map((e) => {
          const isSourceMatch = e.source === nodeId;
          const isTargetMatch = e.target === nodeId;
          const isSourceHandleMatch = e.sourceHandle === nodeId;
          const isTargetHandleMatch = e.targetHandle === nodeId;

          if (!isSourceMatch && !isTargetMatch && !isSourceHandleMatch && !isTargetHandleMatch) {
            return e;
          }

          return {
            ...e,
            source: isSourceMatch ? newId : e.source,
            target: isTargetMatch ? newId : e.target,
            sourceHandle: isSourceHandleMatch ? newId : e.sourceHandle,
            targetHandle: isTargetHandleMatch ? newId : e.targetHandle,
          };
        });

        // 3. Atomically update the store
        set({
          code: data.code || '',
          nodes: nextNodes,
          edges: nextEdges,
          variables: data.variables || [],
          functions: data.functions || [],
          errorMessage: null,
        });
      }
    } catch (err: any) {
      console.error('Failed to rename node:', err);
      set({ errorMessage: err.detail || String(err) });
    } finally {
      set({ isLoading: false });
    }
  },
});

// Private/Internal slice helper functions

function createNewNode(
  nodeType: NodeType,
  existingNodes: AppFlowNode[] = []
): AppFlowNode {
  let newNodeId = '';
  if (nodeType === 'START') {
    newNodeId = 'start';
  } else if (nodeType === 'END') {
    newNodeId = 'end';
  } else {
    const prefix = nodeType.toLowerCase();
    let count = 1;
    while (existingNodes.some(n => n.id === `${prefix}_${count}`)) {
      count++;
    }
    newNodeId = `${prefix}_${count}`;
  }

  const defaultSlots = createDefaultSlotsForNode(nodeType, newNodeId);

  const newNode: ApiNode = {
    id: newNodeId,
    node_type: nodeType,
    is_input: nodeType !== 'START',
    is_output: nodeType === 'START' || nodeType === 'STEP',
    slots: defaultSlots,
    code: '',
    selected: false,
  };

  return {
    id: newNodeId,
    type: 'custom',
    position: { x: 0, y: 0 },
    selected: false,
    style: {
      transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
    data: {
      node: newNode,
    }
  };
}

function updateNodeNodeType(node: AppFlowNode, targetType: NodeType): AppFlowNode {
  if (!node.data?.node) return node;
  return {
    ...node,
    data: {
      ...node.data,
      node: {
        ...node.data.node,
        node_type: targetType,
      }
    }
  };
}

