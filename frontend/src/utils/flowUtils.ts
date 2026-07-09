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

export const createDefaultExpressionsForNode = (
  nodeType: NodeType
): ApiExpression[] => {
  const baseId = crypto.randomUUID();
  const subId = crypto.randomUUID();

  if (nodeType === 'START') {
    return [{
      id: baseId,
      is_input: false,
      is_output: true,
      raw_string: ''
    }];
  } else if (nodeType === 'END') {
    return [{
      id: baseId,
      is_input: true,
      is_output: false,
      raw_string: ''
    }];
  } else if (nodeType === 'FUNCTION' || nodeType === 'AGENT') {
    return [{
      id: baseId,
      is_input: true,
      is_output: true,
      raw_string: ''
    }];
  } else if (nodeType === 'SWITCH') {
    return [
      { id: baseId, is_input: true, is_output: false, raw_string: '' },
      { id: subId, is_input: false, is_output: true, raw_string: '' }
    ];
  } else if (nodeType === 'REDUCE') {
    return [
      { id: subId, is_input: true, is_output: false, raw_string: '' },
      { id: baseId, is_input: false, is_output: true, raw_string: '' }
    ];
  }
  return [];
};

export const mapToReactFlowElements = (
  nodes: ApiNode[],
  edges: ApiEdge[],
  positions: Record<string, { x: number; y: number }> = {},
  defaultTransition = 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)'
): { nodes: AppFlowNode[]; edges: AppFlowEdge[] } => {
  const exprToNodeId: Record<string, string> = {};
  nodes.forEach(n => {
    n.expressions.forEach(e => {
      exprToNodeId[e.id] = n.id;
    });
  });

  const rfNodes = nodes.map(n => {
    const position = positions[n.id] || { x: 0, y: 0 };
    return {
      id: n.id,
      type: 'custom' as const,
      position,
      style: {
        transition: defaultTransition,
      },
      data: {
        node: n,
      },
    };
  });

  const rfEdges = edges
    .filter(edge => exprToNodeId[edge.from_expression_id] && exprToNodeId[edge.to_expression_id])
    .map(edge => {
      return {
        id: edge.id,
        source: exprToNodeId[edge.from_expression_id],
        target: exprToNodeId[edge.to_expression_id],
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
  edges: AppFlowEdge[]
): Promise<{ nodes: AppFlowNode[]; edges: AppFlowEdge[] }> => {
  if (nodes.length === 0) return { nodes, edges };
  try {
    const layout = await getLayoutedElements(nodes, edges);

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
  nodeType: NodeType,
  existingNodes: AppFlowNode[]
): AppFlowNode => {
  const newNodeId = crypto.randomUUID();
  const nextIid = Math.max(...existingNodes.map(n => n.data?.node?.iid ?? 0), 0) + 1;
  const defaultExprs = createDefaultExpressionsForNode(nodeType);

  const newNode: ApiNode = {
    id: newNodeId,
    iid: nextIid,
    node_type: nodeType,
    expressions: defaultExprs,
  };

  return {
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
  const inputExpr = expressions.find(e => e.is_input);
  return inputExpr ? inputExpr.id : '';
};

export const getPrimaryOutputExprId = (expressions: ApiExpression[]): string => {
  const outputExpr = expressions.find(e => e.is_output);
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
  nodes: AppFlowNode[]
): EdgeOption[] => {
  const outgoingEdges = edges.filter(e => e.sourceHandle === expressionId);
  return outgoingEdges.map(edge => {
    const targetNode = nodes.find(n => n.id === edge.target);
    const targetExprIdx = targetNode ? targetNode.data.node.expressions.findIndex(e => e.id === edge.targetHandle) : 0;
    return {
      edgeId: edge.id,
      label: formatExpressionLabel(targetNode, targetExprIdx >= 0 ? targetExprIdx : 0),
    };
  });
};

export const getIncomingEdgeOptions = (
  expressionId: string,
  edges: AppFlowEdge[],
  nodes: AppFlowNode[]
): EdgeOption[] => {
  const incomingEdges = edges.filter(e => e.targetHandle === expressionId);
  return incomingEdges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const sourceExprIdx = sourceNode ? sourceNode.data.node.expressions.findIndex(e => e.id === edge.sourceHandle) : 0;
    return {
      edgeId: edge.id,
      label: formatExpressionLabel(sourceNode, sourceExprIdx >= 0 ? sourceExprIdx : 0),
    };
  });
};
