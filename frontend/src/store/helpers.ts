import { getLayoutedElements, getNodeDimensions } from '../components/layout';
import type { ApiNode, ApiExpression, AppFlowNode, AppFlowEdge, NodeType } from '../components/types';
import type { components } from '../api/generated/schema';
import { apiClient, getClientId } from '../api/client';
import type { StoreApi } from 'zustand';
import type { GraphStoreState } from './types';

type ApiEdge = components['schemas']['EdgeRead'];

export const NODE_LABELS: Record<NodeType, string> = {
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

let onSaveStateChange: ((isSaving: boolean) => void) | null = null;

export const setOnSaveStateChange = (callback: (isSaving: boolean) => void) => {
  onSaveStateChange = callback;
};

export const createDefaultExpressionsForNode = (nodeId: string, graphId: string, nodeType: NodeType): ApiExpression[] => {
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

export const mapToReactFlowElements = (
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

export const runLayout = async (
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

export const triggerSave = (
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
      onSaveStateChange?.(true);
      const res = await apiClient.PUT('/graphs/{graph_id}/sync', {
        params: { path: { graph_id: graphId } },
        headers: { 'X-Client-Id': getClientId() },
        body: payload,
      });
      if ('error' in res) throw res.error;
    } catch (err) {
      console.error('Failed to sync graph flow with backend:', err);
    } finally {
      onSaveStateChange?.(false);
    }
  }, 500);
};

export const resetLastSavedState = (
  graphId: string,
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[]
) => {
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

  lastSavedStateStr = JSON.stringify({
    nodes: nodesPayload,
    edges: edgesPayload,
    expressions,
  });
};

export const takeSnapshot = (state: {
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

export const updateFlowState = async (
  set: StoreApi<GraphStoreState>['setState'],
  get: StoreApi<GraphStoreState>['getState'],
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

  set((state) => ({
    nodes: laidOut.nodes,
    edges: laidOut.edges,
    expressions: updated.expressions,
    past: [...state.past, snapshot],
    future: [],
  }));

  triggerSave(current.graphId, laidOut.nodes, laidOut.edges, updated.expressions);
};
