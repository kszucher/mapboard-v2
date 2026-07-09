import type { components } from '../api/generated/schema';
import { getLayoutedElements } from '../components/layout';
import type { ApiExpression, ApiNode, AppFlowEdge, AppFlowNode, NodeType } from '../components/types';

type ApiEdge = components['schemas']['EdgeRead'];

export const NODE_LABELS: Record<NodeType, string> = {
  START: 'Start',
  END: 'End',
  FUNCTION: 'Function',
  AGENT: 'Agent',
  SWITCH: 'Switch',
  REDUCE: 'Reduce',
};

export const getAvailableConversions = (
  currentType: NodeType
): { targetType: NodeType; label: string }[] => {
  if (currentType === 'START' || currentType === 'END') {
    return [];
  }
  const allTypes: NodeType[] = [
    'FUNCTION',
    'AGENT',
    'SWITCH',
    'REDUCE',
  ];
  return allTypes
    .filter(t => t !== currentType)
    .map(t => ({
      targetType: t,
      label: NODE_LABELS[t],
    }));
};

export const normalizeExpressions = (expressions: ApiExpression[]): ApiExpression[] => {
  const groups: Record<string, ApiExpression[]> = {};
  expressions.forEach(e => {
    (groups[e.node_id] ??= []).push(e);
  });

  const result: ApiExpression[] = [];
  Object.keys(groups).forEach(nodeId => {
    const sorted = [...groups[nodeId]].sort((a, b) => {
      if (a.idx !== b.idx) return a.idx - b.idx;
      return a.id.localeCompare(b.id);
    });

    sorted.forEach((e, idx) => {
      // Keep the same reference when idx is already correct — this is what
      // lets useShallow in CustomNode skip re-rendering unaffected nodes.
      result.push(e.idx === idx ? e : { ...e, idx });
    });
  });

  return result;
};

export const createDefaultExpressionsForNode = (
  nodeId: string,
  graphId: string,
  nodeType: NodeType
): ApiExpression[] => {
  const baseId = crypto.randomUUID();
  const subId = crypto.randomUUID();

  if (nodeType === 'START') {
    return [{
      id: baseId,
      node_id: nodeId,
      graph_id: graphId,
      idx: 0,
      is_input: false,
      is_output: true,
      raw_string: ''
    }];
  } else if (nodeType === 'END') {
    return [{
      id: baseId,
      node_id: nodeId,
      graph_id: graphId,
      idx: 0,
      is_input: true,
      is_output: false,
      raw_string: ''
    }];
  } else if (nodeType === 'FUNCTION' || nodeType === 'AGENT') {
    return [{
      id: baseId,
      node_id: nodeId,
      graph_id: graphId,
      idx: 0,
      is_input: true,
      is_output: true,
      raw_string: ''
    }];
  } else if (nodeType === 'SWITCH') {
    return [
      { id: baseId, node_id: nodeId, graph_id: graphId, idx: 0, is_input: true, is_output: false, raw_string: '' },
      { id: subId, node_id: nodeId, graph_id: graphId, idx: 1, is_input: false, is_output: true, raw_string: '' }
    ];
  } else if (nodeType === 'REDUCE') {
    return [
      { id: subId, node_id: nodeId, graph_id: graphId, idx: 0, is_input: true, is_output: false, raw_string: '' },
      { id: baseId, node_id: nodeId, graph_id: graphId, idx: 1, is_input: false, is_output: true, raw_string: '' }
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
  const normalizedExprs = normalizeExpressions(expressions);
  const expressionIds = new Set(normalizedExprs.map(e => e.id));

  const rfNodes = nodes.map(n => {
    const position = (n.position as { x: number; y: number } | null) || positions[n.id] || { x: 0, y: 0 };
    return {
      id: n.id,
      type: 'custom' as const,
      position,
      style: {
        transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
      },
      data: {
        node: n,
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
      };
    });

  return { nodes: rfNodes, edges: rfEdges };
};

export const runLayout = async (
  nodes: AppFlowNode[],
  edges: AppFlowEdge[],
  expressions: ApiExpression[]
): Promise<{ nodes: AppFlowNode[]; edges: AppFlowEdge[] }> => {
  if (nodes.length === 0) return { nodes, edges };
  try {
    const layout = await getLayoutedElements(nodes, edges, expressions);

    const updatedNodes = nodes.map(n => {
      const newPos = layout.positions[n.id] || n.position;
      const posChanged = Math.abs(newPos.x - n.position.x) > 0.01 || Math.abs(newPos.y - n.position.y) > 0.01;

      if (!posChanged) {
        return n;
      }

      return {
        ...n,
        position: newPos,
      };
    });

    const updatedEdges = edges.map(e => {
      const elkEdge = layout.edgeSections[e.id];
      const sections = elkEdge?.sections ?? [];

      const sectionsChanged = JSON.stringify(e.data?.sections) !== JSON.stringify(sections);

      if (!sectionsChanged) {
        return e;
      }

      return {
        ...e,
        data: {
          ...e.data,
          sections,
        },
      };
    });

    return { nodes: updatedNodes, edges: updatedEdges };
  } catch (err) {
    console.error('Failed to run ELK layout:', err);
    return { nodes, edges };
  }
};

export const createNewNode = (
  graphId: string,
  nodeType: NodeType,
  existingNodes: AppFlowNode[]
): { appNode: AppFlowNode; defaultExprs: ApiExpression[] } => {
  const newNodeId = crypto.randomUUID();
  const nextIid = Math.max(...existingNodes.map(n => n.data?.node?.iid ?? 0), 0) + 1;

  const newNode: ApiNode = {
    id: newNodeId,
    graph_id: graphId,
    iid: nextIid,
    is_processing: false,
    node_type: nodeType,
  };

  const defaultExprs = createDefaultExpressionsForNode(newNodeId, graphId, nodeType);

  const appNode: AppFlowNode = {
    id: newNodeId,
    type: 'custom',
    position: { x: 0, y: 0 },
    style: {
      transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
    data: {
      node: newNode,
    }
  };

  return { appNode, defaultExprs };
};

export const canShortcircuitNode = (expressions: ApiExpression[]): boolean => {
  const inputs = expressions.filter(e => e.is_input);
  const outputs = expressions.filter(e => e.is_output);
  return inputs.length === 1 && outputs.length === 1;
};

export const canMoveExpressionUp = (index: number): boolean => {
  return index > 0;
};

export const canMoveExpressionDown = (index: number, totalCount: number): boolean => {
  return index < totalCount - 1;
};

export const getPrimaryInputExprId = (expressions: ApiExpression[]): string => {
  const sorted = [...expressions].sort((a, b) => a.idx - b.idx);
  const inputExpr = sorted.find(e => e.is_input);
  return inputExpr ? inputExpr.id : '';
};

export const getPrimaryOutputExprId = (expressions: ApiExpression[]): string => {
  const sorted = [...expressions].sort((a, b) => a.idx - b.idx);
  const outputExpr = sorted.find(e => e.is_output);
  return outputExpr ? outputExpr.id : '';
};

export const updateNodeNodeType = (node: AppFlowNode, targetType: NodeType): AppFlowNode => {
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
};

export const formatExpressionLabel = (
  node: AppFlowNode | undefined,
  exprIdx: number
): string => {
  return node ? `N${node.data.node.iid}-${exprIdx}` : `?-${exprIdx}`;
};

export interface EdgeOption {
  edgeId: string;
  label: string;
}

export const getOutgoingEdgeOptions = (
  expressionId: string,
  edges: AppFlowEdge[],
  expressions: ApiExpression[],
  nodes: AppFlowNode[]
): EdgeOption[] => {
  const outgoingEdges = edges.filter(e => e.sourceHandle === expressionId);
  return outgoingEdges.map(edge => {
    const targetExpr = expressions.find(e => e.id === edge.targetHandle);
    const targetNode = nodes.find(n => n.id === edge.target);
    return {
      edgeId: edge.id,
      label: formatExpressionLabel(targetNode, targetExpr?.idx ?? 0),
    };
  });
};

export const getIncomingEdgeOptions = (
  expressionId: string,
  edges: AppFlowEdge[],
  expressions: ApiExpression[],
  nodes: AppFlowNode[]
): EdgeOption[] => {
  const incomingEdges = edges.filter(e => e.targetHandle === expressionId);
  return incomingEdges.map(edge => {
    const sourceExpr = expressions.find(e => e.id === edge.sourceHandle);
    const sourceNode = nodes.find(n => n.id === edge.source);
    return {
      edgeId: edge.id,
      label: formatExpressionLabel(sourceNode, sourceExpr?.idx ?? 0),
    };
  });
};

export const getSortedNodeExpressions = (
  expressions: ApiExpression[],
  nodeId: string
): ApiExpression[] => {
  return expressions
    .filter(e => e.node_id === nodeId)
    .sort((a, b) => a.idx - b.idx);
};
