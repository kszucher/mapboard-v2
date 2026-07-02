import { create } from 'zustand';
import {
  applyNodeChanges,
  applyEdgeChanges,
  type NodeChange,
  type EdgeChange,
  type Connection,
} from '@xyflow/react';
import { apiClient, getClientId } from '../api/client';
import type { components } from '../api/generated/schema';
import { getLayoutedElements, getNodeDimensions } from '../components/layout';
import type { ApiNode, ApiExpression, AppFlowNode, AppFlowEdge, NodeType } from '../components/types';

type GraphFlowRead = components['schemas']['GraphFlowRead'];
type ApiEdge = components['schemas']['EdgeRead'];

const NODE_LABELS: Record<NodeType, string> = {
  START: 'Start',
  END: 'End',
  LOGIC: 'Logic',
  AGENT: 'Agent',
  LOGICAL_SWITCH: 'Logical Switch',
  AGENTIC_SWITCH: 'Agentic Switch',
  LOGICAL_JOIN: 'Logical Join',
  AGENTIC_JOIN: 'Agentic Join',
  TRANSFORM_AGENT_TO_LOGICAL: 'Transform Agent To Logical',
  TRANSFORM_LOGICAL_TO_AGENT: 'Transform Logical To Agent',
};

const createDefaultExpressionsForNode = (nodeId: string, graphId: string, nodeType: NodeType): ApiExpression[] => {
  const baseId = crypto.randomUUID();
  const subId = crypto.randomUUID();
  const baseOutId = crypto.randomUUID();

  if (nodeType === 'START') {
    return [{ id: baseId, node_id: nodeId, graph_id: graphId, idx: 0, type: 'BASE_OUTPUT', raw_string: '' }];
  } else if (nodeType === 'END') {
    return [{ id: baseId, node_id: nodeId, graph_id: graphId, idx: 0, type: 'BASE_INPUT', raw_string: '' }];
  } else if (nodeType === 'LOGIC' || nodeType === 'AGENT') {
    return [{ id: baseId, node_id: nodeId, graph_id: graphId, idx: 0, type: 'BASE_INPUT_OUTPUT', raw_string: '' }];
  } else if (nodeType === 'LOGICAL_SWITCH' || nodeType === 'AGENTIC_SWITCH') {
    return [
      { id: baseId, node_id: nodeId, graph_id: graphId, idx: 0, type: 'BASE_INPUT', raw_string: '' },
      { id: subId, node_id: nodeId, graph_id: graphId, idx: 0, type: 'SUB_OUTPUT', raw_string: '' }
    ];
  } else if (nodeType === 'LOGICAL_JOIN' || nodeType === 'AGENTIC_JOIN') {
    return [
      { id: subId, node_id: nodeId, graph_id: graphId, idx: 0, type: 'SUB_INPUT', raw_string: '' },
      { id: baseId, node_id: nodeId, graph_id: graphId, idx: 0, type: 'BASE_OUTPUT', raw_string: '' }
    ];
  } else if (nodeType === 'TRANSFORM_AGENT_TO_LOGICAL' || nodeType === 'TRANSFORM_LOGICAL_TO_AGENT') {
    return [
      { id: baseId, node_id: nodeId, graph_id: graphId, idx: 0, type: 'BASE_INPUT', raw_string: '' },
      { id: subId, node_id: nodeId, graph_id: graphId, idx: 0, type: 'SUB_UNCONNECTED', raw_string: '' },
      { id: baseOutId, node_id: nodeId, graph_id: graphId, idx: 0, type: 'BASE_OUTPUT', raw_string: '' }
    ];
  }
  return [];
};

const mapToReactFlowElements = (
  nodes: ApiNode[],
  edges: ApiEdge[],
  expressions: ApiExpression[],
  positions: Record<string, { x: number; y: number }> = {}
): { nodes: AppFlowNode[]; edges: AppFlowEdge[] } => {
  const nodeIds = new Set(nodes.map(n => n.id));
  const expressionIds = new Set(expressions.map(e => e.id));

  const rfNodes = nodes.map(n => {
    const nodeExpressions = expressions.filter(e => e.node_id === n.id);
    const { width, height } = getNodeDimensions(n.node_type, nodeExpressions);
    const position = (n.position as { x: number; y: number } | null) || positions[n.id] || { x: 0, y: 0 };
    return {
      id: n.id,
      type: 'custom' as const,
      position,
      style: { width, height },
      data: {
        node: n,
        expressions: nodeExpressions,
        isPositioned: !!n.position || !!positions[n.id],
      },
    };
  });

  const rfEdges = edges
    .filter(edge => {
      if (!nodeIds.has(edge.from_node_id) || !nodeIds.has(edge.to_node_id)) return false;
      if (edge.from_expression_id && !expressionIds.has(edge.from_expression_id)) return false;
      return true;
    })
    .map(edge => {
      const sourcePos = positions[edge.from_node_id] || { x: 0, y: 0 };
      const targetPos = positions[edge.to_node_id] || { x: 0, y: 0 };
      const isBack = targetPos.x <= sourcePos.x;

      return {
        id: edge.id,
        source: edge.from_node_id,
        target: edge.to_node_id,
        sourceHandle: edge.from_expression_id,
        targetHandle: edge.to_expression_id,
        type: 'custom' as const,
        animated: true,
        data: {
          sections: [],
        },
        style: {
          stroke: isBack ? '#ff9800' : '#888888',
          strokeWidth: isBack ? 2.5 : 2,
          opacity: 0,
          transition: 'opacity 0.2s ease-in-out',
        },
        deletable: true,
        reconnectable: true,
      };
    });

  return { nodes: rfNodes, edges: rfEdges };
};

const runLayout = async (
  nodes: AppFlowNode[],
  edges: AppFlowEdge[]
): Promise<{ nodes: AppFlowNode[]; edges: AppFlowEdge[] }> => {
  if (nodes.length === 0) return { nodes, edges };
  try {
    const layout = await getLayoutedElements(nodes, edges);

    const updatedNodes = nodes.map(n => ({
      ...n,
      position: layout.positions[n.id] || n.position,
      data: {
        ...n.data,
        isPositioned: true,
      }
    }));

    const updatedEdges = edges.map(e => {
      const sourcePos = layout.positions[e.source] || { x: 0, y: 0 };
      const targetPos = layout.positions[e.target] || { x: 0, y: 0 };
      const isBack = targetPos.x <= sourcePos.x;
      const elkEdge = layout.edgeSections[e.id];
      const sections = elkEdge?.sections ?? [];

      return {
        ...e,
        data: {
          ...e.data,
          sections,
        },
        style: {
          ...e.style,
          stroke: isBack ? '#ff9800' : '#888888',
          strokeWidth: isBack ? 2.5 : 2,
          opacity: sections.length > 0 ? 1 : 0,
        }
      };
    });

    return { nodes: updatedNodes, edges: updatedEdges };
  } catch (err) {
    console.error('Failed to run ELK layout:', err);
    return { nodes, edges };
  }
};

let saveTimeout: number | null = null;
let lastSavedStateStr: string | null = null;

const triggerSave = (
  graphId: string | null,
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[]
) => {
  if (!graphId) return;

  if (saveTimeout !== null) {
    window.clearTimeout(saveTimeout);
  }

  saveTimeout = window.setTimeout(async () => {
    const nodesPayload = nodes.map(n => ({
      id: n.id,
      graph_id: n.data?.node?.graph_id || graphId,
      iid: n.data?.node?.iid ?? 0,
      label: n.data?.node?.label ?? '',
      is_processing: n.data?.node?.is_processing ?? false,
      node_type: n.data?.node?.node_type ?? 'LOGIC',
      position: n.position,
    }));

    const edgesPayload = edges.map(e => ({
      id: e.id,
      graph_id: graphId,
      from_expression_id: e.sourceHandle || '',
      to_expression_id: e.targetHandle || '',
      from_node_id: e.source,
      to_node_id: e.target,
    }));

    const payload = {
      nodes: nodesPayload,
      edges: edgesPayload,
      expressions,
    };

    const stateStr = JSON.stringify(payload);
    if (stateStr === lastSavedStateStr) {
      return;
    }
    lastSavedStateStr = stateStr;

    try {
      useGraphStore.setState({ isSaving: true });
      const res = await apiClient.PUT('/graphs/{graph_id}/sync', {
        params: { path: { graph_id: graphId } },
        headers: { 'X-Client-Id': getClientId() },
        body: payload,
      });
      if ('error' in res) throw res.error;
    } catch (err) {
      console.error('Failed to sync graph flow with backend:', err);
    } finally {
      useGraphStore.setState({ isSaving: false });
    }
  }, 500);
};

const takeSnapshot = (state: {
  nodes: AppFlowNode[];
  edges: AppFlowEdge[];
  expressions: ApiExpression[];
}) => {
  return {
    nodes: JSON.parse(JSON.stringify(state.nodes)) as AppFlowNode[],
    edges: JSON.parse(JSON.stringify(state.edges)) as AppFlowEdge[],
    expressions: JSON.parse(JSON.stringify(state.expressions)) as ApiExpression[],
  };
};

const updateFlowState = async (
  set: any,
  get: any,
  updateFn: (state: {
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    expressions: ApiExpression[];
  }) => {
    nodes: AppFlowNode[];
    edges: AppFlowEdge[];
    expressions: ApiExpression[];
  }
) => {
  const current = get();
  const snapshot = takeSnapshot(current);
  const updated = updateFn(current);

  const nodesWithDimensions = updated.nodes.map(n => {
    const nodeExpressions = updated.expressions.filter(e => e.node_id === n.id);
    const { width, height } = getNodeDimensions(n.data?.node?.node_type ?? 'LOGIC', nodeExpressions);
    return {
      ...n,
      style: { ...n.style, width, height },
      data: {
        ...n.data,
        expressions: nodeExpressions,
      }
    };
  });

  const laidOut = await runLayout(nodesWithDimensions, updated.edges);

  set((state: any) => ({
    nodes: laidOut.nodes,
    edges: laidOut.edges,
    expressions: updated.expressions,
    past: [...state.past, snapshot],
    future: [],
  }));

  triggerSave(current.graphId, laidOut.nodes, laidOut.edges, updated.expressions);
};

interface GraphStoreState {
  graphId: string | null;
  nodes: AppFlowNode[];
  edges: AppFlowEdge[];
  expressions: ApiExpression[];
  past: Array<{ nodes: AppFlowNode[]; edges: AppFlowEdge[]; expressions: ApiExpression[] }>;
  future: Array<{ nodes: AppFlowNode[]; edges: AppFlowEdge[]; expressions: ApiExpression[] }>;
  isLoading: boolean;
  isSaving: boolean;

  init: (graphId: string) => Promise<void>;
  updateFromWebSocket: (flow: GraphFlowRead) => void;
  onNodesChange: (changes: NodeChange[]) => void;
  onEdgesChange: (changes: EdgeChange[]) => void;
  onConnect: (connection: Connection) => void;
  onEdgesDelete: (edgesToDelete: AppFlowEdge[]) => void;
  onReconnect: (oldEdge: AppFlowEdge, newConnection: Connection) => void;
  onNodeDragStop: () => void;

  addNode: (nodeType: NodeType) => Promise<void>;
  addConnectedNode: (expressionId: string, nodeType: NodeType) => Promise<void>;
  insertNodeBetween: (expressionId: string, nodeType: NodeType) => Promise<void>;
  deleteNode: (nodeId: string) => Promise<void>;
  shortcircuitNode: (nodeId: string) => Promise<void>;
  convertNode: (nodeId: string, targetType: NodeType) => Promise<void>;

  createExpression: (nodeId: string, type: string, idx: number) => Promise<void>;
  deleteExpression: (expressionId: string) => Promise<void>;
  updateExpression: (expressionId: string, raw_string: string) => void;
  swapExpressionIndices: (expressionId: string, direction: 'up' | 'down') => Promise<void>;

  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

export const useGraphStore = create<GraphStoreState>((set, get) => ({
  graphId: null,
  nodes: [],
  edges: [],
  expressions: [],
  past: [],
  future: [],
  isLoading: false,
  isSaving: false,

  init: async (graphId) => {
    set({ graphId, isLoading: true, past: [], future: [] });
    try {
      const res = await apiClient.GET('/graphs/{graph_id}/flow', {
        params: { path: { graph_id: graphId } }
      });
      if ('error' in res) throw res.error;
      const data = res.data;
      if (data) {
        const positions: Record<string, { x: number; y: number }> = {};
        data.nodes.forEach(n => {
          if (n.position) {
            positions[n.id] = n.position as { x: number; y: number };
          }
        });

        const mapped = mapToReactFlowElements(data.nodes, data.edges, data.expressions, positions);

        const anyPositioned = mapped.nodes.some(n => n.data?.isPositioned);
        let finalNodes = mapped.nodes;
        let finalEdges = mapped.edges;

        if (!anyPositioned && mapped.nodes.length > 0) {
          const laidOut = await runLayout(mapped.nodes, mapped.edges);
          finalNodes = laidOut.nodes;
          finalEdges = laidOut.edges;
          triggerSave(graphId, laidOut.nodes, laidOut.edges, data.expressions);
        } else {
          const laidOut = await runLayout(mapped.nodes, mapped.edges);
          finalNodes = laidOut.nodes;
          finalEdges = laidOut.edges;
        }

        set({
          nodes: finalNodes,
          edges: finalEdges,
          expressions: data.expressions,
        });

        const nodesPayload = finalNodes.map(n => ({
          id: n.id,
          graph_id: n.data?.node?.graph_id || graphId,
          iid: n.data?.node?.iid ?? 0,
          label: n.data?.node?.label ?? '',
          is_processing: n.data?.node?.is_processing ?? false,
          node_type: n.data?.node?.node_type ?? 'LOGIC',
          position: n.position,
        }));

        const edgesPayload = finalEdges.map(e => ({
          id: e.id,
          graph_id: graphId,
          from_expression_id: e.sourceHandle || '',
          to_expression_id: e.targetHandle || '',
          from_node_id: e.source,
          to_node_id: e.target,
        }));

        lastSavedStateStr = JSON.stringify({
          nodes: nodesPayload,
          edges: edgesPayload,
          expressions: data.expressions,
        });
      }
    } catch (err) {
      console.error('Failed to initialize graph:', err);
    } finally {
      set({ isLoading: false });
    }
  },

  updateFromWebSocket: (flow) => {
    const { graphId, nodes } = get();
    if (!graphId) return;

    const positions: Record<string, { x: number; y: number }> = {};
    nodes.forEach(n => {
      positions[n.id] = n.position;
    });

    flow.nodes.forEach(n => {
      if (n.position) {
        positions[n.id] = n.position as { x: number; y: number };
      }
    });

    const mapped = mapToReactFlowElements(flow.nodes, flow.edges, flow.expressions, positions);

    runLayout(mapped.nodes, mapped.edges).then(laidOut => {
      set({
        nodes: laidOut.nodes,
        edges: laidOut.edges,
        expressions: flow.expressions,
      });
    });
  },

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

  onConnect: async (connection) => {
    if (!connection.source || !connection.target || !connection.sourceHandle || !connection.targetHandle) return;

    await updateFlowState(set, get, (state) => {
      const exists = state.edges.some(e => e.sourceHandle === connection.sourceHandle);
      if (exists) {
        alert('Expression is already connected to another node.');
        return state;
      }

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
      const exists = state.edges.some(e => e.id !== oldEdge.id && e.sourceHandle === newConnection.sourceHandle);
      if (exists) {
        alert('Expression is already connected to another node.');
        return state;
      }

      const updatedEdge = {
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

  onNodeDragStop: () => {
    const { graphId, nodes, edges, expressions } = get();
    triggerSave(graphId, nodes, edges, expressions);
  },

  addNode: async (nodeType) => {
    const { graphId } = get();
    if (!graphId) return;

    await updateFlowState(set, get, (state) => {
      const newNodeId = crypto.randomUUID();
      const nextIid = Math.max(...state.nodes.map(n => n.data?.node?.iid ?? 0), 0) + 1;
      const label = NODE_LABELS[nodeType];

      const newNode: ApiNode = {
        id: newNodeId,
        graph_id: graphId,
        iid: nextIid,
        label,
        is_processing: false,
        node_type: nodeType,
      };

      const defaultExprs = createDefaultExpressionsForNode(newNodeId, graphId, nodeType);

      const appNode: AppFlowNode = {
        id: newNodeId,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          node: newNode,
          expressions: defaultExprs,
          isPositioned: false,
        }
      };

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

      const newNodeId = crypto.randomUUID();
      const nextIid = Math.max(...state.nodes.map(n => n.data?.node?.iid ?? 0), 0) + 1;
      const label = NODE_LABELS[nodeType];

      const newNode: ApiNode = {
        id: newNodeId,
        graph_id: graphId,
        iid: nextIid,
        label,
        is_processing: false,
        node_type: nodeType,
      };

      const defaultExprs = createDefaultExpressionsForNode(newNodeId, graphId, nodeType);

      let toExprId = '';
      const baseInput = defaultExprs.find(e => e.type === 'BASE_INPUT');
      const baseInputOutput = defaultExprs.find(e => e.type === 'BASE_INPUT_OUTPUT');
      const subInputs = defaultExprs.filter(e => e.type === 'SUB_INPUT').sort((a, b) => a.idx - b.idx);

      if (baseInput) toExprId = baseInput.id;
      else if (baseInputOutput) toExprId = baseInputOutput.id;
      else if (subInputs.length > 0) toExprId = subInputs[0].id;

      const appNode: AppFlowNode = {
        id: newNodeId,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          node: newNode,
          expressions: defaultExprs,
          isPositioned: false,
        }
      };

      const newEdgeId = crypto.randomUUID();
      const fromNodeId = state.expressions.find(e => e.id === expressionId)?.node_id || '';

      const newEdge: AppFlowEdge = {
        id: newEdgeId,
        source: fromNodeId,
        target: newNodeId,
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

      const newNodeId = crypto.randomUUID();
      const nextIid = Math.max(...state.nodes.map(n => n.data?.node?.iid ?? 0), 0) + 1;
      const label = NODE_LABELS[nodeType];

      const newNode: ApiNode = {
        id: newNodeId,
        graph_id: graphId,
        iid: nextIid,
        label,
        is_processing: false,
        node_type: nodeType,
      };

      const defaultExprs = createDefaultExpressionsForNode(newNodeId, graphId, nodeType);

      let toExprId = '';
      const baseInput = defaultExprs.find(e => e.type === 'BASE_INPUT');
      const baseInputOutput = defaultExprs.find(e => e.type === 'BASE_INPUT_OUTPUT');
      const subInputs = defaultExprs.filter(e => e.type === 'SUB_INPUT').sort((a, b) => a.idx - b.idx);
      if (baseInput) toExprId = baseInput.id;
      else if (baseInputOutput) toExprId = baseInputOutput.id;
      else if (subInputs.length > 0) toExprId = subInputs[0].id;

      let fromExprId = '';
      const baseOutput = defaultExprs.find(e => e.type === 'BASE_OUTPUT');
      const baseInputOutputOut = defaultExprs.find(e => e.type === 'BASE_INPUT_OUTPUT');
      const subOutputs = defaultExprs.filter(e => e.type === 'SUB_OUTPUT').sort((a, b) => a.idx - b.idx);
      if (baseOutput) fromExprId = baseOutput.id;
      else if (baseInputOutputOut) fromExprId = baseInputOutputOut.id;
      else if (subOutputs.length > 0) fromExprId = subOutputs[0].id;

      const appNode: AppFlowNode = {
        id: newNodeId,
        type: 'custom',
        position: { x: 0, y: 0 },
        data: {
          node: newNode,
          expressions: defaultExprs,
          isPositioned: false,
        }
      };

      const updatedOldEdge = {
        ...oldEdge,
        target: newNodeId,
        targetHandle: toExprId,
      };

      const newEdge: AppFlowEdge = {
        id: crypto.randomUUID(),
        source: newNodeId,
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
    await updateFlowState(set, get, (state) => {
      const node = state.nodes.find(n => n.id === nodeId);
      if (!node) return state;

      const nodeType = node.data?.node?.node_type;
      if (!nodeType || nodeType === 'START' || nodeType === 'END') return state;

      const nodeExprs = state.expressions.filter(e => e.node_id === nodeId);
      const subExprs = nodeExprs.filter(e => e.type.startsWith('SUB_'));

      if (['LOGICAL_SWITCH', 'AGENTIC_SWITCH', 'LOGICAL_JOIN', 'AGENTIC_JOIN', 'TRANSFORM_AGENT_TO_LOGICAL', 'TRANSFORM_LOGICAL_TO_AGENT'].includes(nodeType)) {
        if (subExprs.length !== 1) return state;
      }

      const nodeExprIds = new Set(nodeExprs.map(e => e.id));
      const incoming = state.edges.filter(e => nodeExprIds.has(e.targetHandle || ''));
      const outgoing = state.edges.filter(e => nodeExprIds.has(e.sourceHandle || ''));

      let nextEdges = state.edges.filter(e => !nodeExprIds.has(e.sourceHandle || '') && !nodeExprIds.has(e.targetHandle || ''));

      if (incoming.length > 0 && outgoing.length > 0) {
        const sortedOutgoing = [...outgoing].sort((a, b) => a.id.localeCompare(b.id));
        const primaryTargetHandle = sortedOutgoing[0].targetHandle;
        const primaryTargetNode = sortedOutgoing[0].target;

        const reRoutedIncoming = incoming.map(e => ({
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

      let nextExpressions = [...state.expressions];
      let nextEdges = [...state.edges];

      if ((currentType === 'AGENT' && targetType === 'LOGIC') || (currentType === 'LOGIC' && targetType === 'AGENT')) {
        const updatedNode = {
          ...node,
          data: {
            ...node.data,
            node: {
              ...node.data.node,
              node_type: targetType,
              label: NODE_LABELS[targetType],
            }
          }
        };
        const nextNodes = [...state.nodes];
        nextNodes[nodeIndex] = updatedNode;
        return { nodes: nextNodes, edges: state.edges, expressions: state.expressions };
      }

      if (['AGENTIC_SWITCH', 'LOGICAL_SWITCH'].includes(currentType) && ['TRANSFORM_AGENT_TO_LOGICAL', 'TRANSFORM_LOGICAL_TO_AGENT'].includes(targetType)) {
        const newBaseOutputId = crypto.randomUUID();
        const newBaseOutput: ApiExpression = {
          id: newBaseOutputId,
          node_id: nodeId,
          graph_id: node.data?.node?.graph_id || '',
          idx: 0,
          type: 'BASE_OUTPUT',
          raw_string: '',
        };

        const nodeExprs = state.expressions.filter(e => e.node_id === nodeId);
        const subOutputs = nodeExprs.filter(e => e.type === 'SUB_OUTPUT');

        nextExpressions = state.expressions.map(e => {
          if (e.node_id === nodeId && e.type === 'SUB_OUTPUT') {
            return { ...e, type: 'SUB_UNCONNECTED' };
          }
          return e;
        });
        nextExpressions.push(newBaseOutput);

        const subOutputIds = new Set(subOutputs.map(e => e.id));
        nextEdges = state.edges.map(edge => {
          if (edge.sourceHandle && subOutputIds.has(edge.sourceHandle)) {
            return { ...edge, sourceHandle: newBaseOutputId };
          }
          return edge;
        });

        const updatedNode = {
          ...node,
          data: {
            ...node.data,
            node: {
              ...node.data.node,
              node_type: targetType,
              label: NODE_LABELS[targetType],
            }
          }
        };
        const nextNodes = [...state.nodes];
        nextNodes[nodeIndex] = updatedNode;

        return { nodes: nextNodes, edges: nextEdges, expressions: nextExpressions };
      }

      if (['TRANSFORM_AGENT_TO_LOGICAL', 'TRANSFORM_LOGICAL_TO_AGENT'].includes(currentType) && ['AGENTIC_SWITCH', 'LOGICAL_SWITCH'].includes(targetType)) {
        const nodeExprs = state.expressions.filter(e => e.node_id === nodeId);
        const baseOutput = nodeExprs.find(e => e.type === 'BASE_OUTPUT');
        if (!baseOutput) return state;

        const outgoingEdges = state.edges.filter(e => e.sourceHandle === baseOutput.id);
        if (outgoingEdges.length > 1) {
          alert('Cannot convert to Switch node: the BASE_OUTPUT has multiple outgoing edges. At most one is allowed.');
          return state;
        }

        const subUnconnecteds = nodeExprs.filter(e => e.type === 'SUB_UNCONNECTED').sort((a, b) => a.idx - b.idx);
        if (subUnconnecteds.length === 0) return state;

        if (outgoingEdges.length === 1) {
          const firstSub = subUnconnecteds[0];
          nextEdges = state.edges.map(edge => {
            if (edge.sourceHandle === baseOutput.id) {
              return { ...edge, sourceHandle: firstSub.id };
            }
            return edge;
          });
        }

        nextExpressions = state.expressions
          .filter(e => e.id !== baseOutput.id)
          .map(e => {
            if (e.node_id === nodeId && e.type === 'SUB_UNCONNECTED') {
              return { ...e, type: 'SUB_OUTPUT' };
            }
            return e;
          });

        const updatedNode = {
          ...node,
          data: {
            ...node.data,
            node: {
              ...node.data.node,
              node_type: targetType,
              label: NODE_LABELS[targetType],
            }
          }
        };
        const nextNodes = [...state.nodes];
        nextNodes[nodeIndex] = updatedNode;

        return { nodes: nextNodes, edges: nextEdges, expressions: nextExpressions };
      }

      return state;
    });
  },

  createExpression: async (nodeId, type, idx) => {
    await updateFlowState(set, get, (state) => {
      const { graphId } = get();
      if (!graphId) return state;

      const newExprId = crypto.randomUUID();
      const newExpr: ApiExpression = {
        id: newExprId,
        node_id: nodeId,
        graph_id: graphId,
        idx,
        type,
        raw_string: '',
      };

      const nextExpressions = state.expressions.map(e => {
        if (e.node_id === nodeId && e.type === type && e.idx >= idx) {
          return { ...e, idx: e.idx + 1 };
        }
        return e;
      });
      nextExpressions.push(newExpr);

      return {
        nodes: state.nodes,
        edges: state.edges,
        expressions: nextExpressions,
      };
    });
  },

  deleteExpression: async (expressionId) => {
    await updateFlowState(set, get, (state) => {
      const expr = state.expressions.find(e => e.id === expressionId);
      if (!expr || expr.type.startsWith('BASE_')) return state;

      const nodeExprs = state.expressions.filter(e => e.node_id === expr.node_id && e.type === expr.type);
      if (nodeExprs.length <= 1) {
        alert('Cannot delete the last remaining expression of this type.');
        return state;
      }

      const deletedIdx = expr.idx;

      let nextExpressions = state.expressions.filter(e => e.id !== expressionId);
      nextExpressions = nextExpressions.map(e => {
        if (e.node_id === expr.node_id && e.type === expr.type && e.idx > deletedIdx) {
          return { ...e, idx: e.idx - 1 };
        }
        return e;
      });

      const nextEdges = state.edges.filter(e => e.sourceHandle !== expressionId && e.targetHandle !== expressionId);

      return {
        nodes: state.nodes,
        edges: nextEdges,
        expressions: nextExpressions,
      };
    });
  },

  updateExpression: (expressionId, raw_string) => {
    set((state) => {
      const nextExpressions = state.expressions.map(e =>
        e.id === expressionId ? { ...e, raw_string } : e
      );

      const expr = nextExpressions.find(e => e.id === expressionId);
      const nextNodes = state.nodes.map(n => {
        if (expr && n.id === expr.node_id) {
          const nodeExpressions = nextExpressions.filter(e => e.node_id === n.id);
          const { width, height } = getNodeDimensions(n.data?.node?.node_type ?? 'LOGIC', nodeExpressions);
          return {
            ...n,
            style: { ...n.style, width, height },
            data: { ...n.data, expressions: nodeExpressions }
          };
        }
        return n;
      });

      triggerSave(state.graphId, nextNodes, state.edges, nextExpressions);

      return {
        nodes: nextNodes,
        expressions: nextExpressions,
      };
    });
  },

  swapExpressionIndices: async (expressionId, direction) => {
    await updateFlowState(set, get, (state) => {
      const expr = state.expressions.find(e => e.id === expressionId);
      if (!expr || expr.type.startsWith('BASE_')) return state;

      const nodeSameTypeExprs = state.expressions
        .filter(e => e.node_id === expr.node_id && e.type === expr.type)
        .sort((a, b) => a.idx - b.idx);

      const currentIndex = nodeSameTypeExprs.findIndex(e => e.id === expressionId);
      if (currentIndex === -1) return state;

      let targetIndex = -1;
      if (direction === 'up' && currentIndex > 0) targetIndex = currentIndex - 1;
      else if (direction === 'down' && currentIndex < nodeSameTypeExprs.length - 1) targetIndex = currentIndex + 1;

      if (targetIndex === -1) return state;

      const otherExpr = nodeSameTypeExprs[targetIndex];

      const nextExpressions = state.expressions.map(e => {
        if (e.id === expr.id) {
          return { ...e, idx: otherExpr.idx };
        }
        if (e.id === otherExpr.id) {
          return { ...e, idx: expr.idx };
        }
        return e;
      });

      return {
        nodes: state.nodes,
        edges: state.edges,
        expressions: nextExpressions,
      };
    });
  },

  undo: () => {
    const { past, future, nodes, edges, expressions, graphId } = get();
    if (past.length === 0) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, -1);
    const currentSnapshot = takeSnapshot({ nodes, edges, expressions });

    set({
      nodes: previous.nodes,
      edges: previous.edges,
      expressions: previous.expressions,
      past: newPast,
      future: [currentSnapshot, ...future],
    });

    triggerSave(graphId, previous.nodes, previous.edges, previous.expressions);
  },

  redo: () => {
    const { past, future, nodes, edges, expressions, graphId } = get();
    if (future.length === 0) return;

    const next = future[0];
    const newFuture = future.slice(1);
    const currentSnapshot = takeSnapshot({ nodes, edges, expressions });

    set({
      nodes: next.nodes,
      edges: next.edges,
      expressions: next.expressions,
      past: [...past, currentSnapshot],
      future: newFuture,
    });

    triggerSave(graphId, next.nodes, next.edges, next.expressions);
  },

  canUndo: () => get().past.length > 0,
  canRedo: () => get().future.length > 0,
}));
