import type { components } from '../api/generated/schema';
import { getLayoutedElements } from '../components/layout';
import type { ApiExpression, ApiNode, AppFlowEdge, AppFlowNode, NodeType } from '../components/types';

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

export const NODE_CONVERSIONS: Record<NodeType, { targetType: NodeType; label: string } | null> = {
  AGENT: { targetType: 'LOGIC', label: 'Logic' },
  LOGIC: { targetType: 'AGENT', label: 'Agent' },
  AGENTIC_SWITCH: { targetType: 'TRANSFORM_AGENT_TO_LOGICAL', label: 'Transform Agent To Logical' },
  TRANSFORM_AGENT_TO_LOGICAL: { targetType: 'AGENTIC_SWITCH', label: 'Agentic Switch' },
  LOGICAL_SWITCH: { targetType: 'TRANSFORM_LOGICAL_TO_AGENT', label: 'Transform Logical to Agent' },
  TRANSFORM_LOGICAL_TO_AGENT: { targetType: 'LOGICAL_SWITCH', label: 'Logical Switch' },
  START: null,
  END: null,
  LOGICAL_JOIN: null,
  AGENTIC_JOIN: null,
};

export const createDefaultExpressionsForNode = (
  nodeId: string,
  graphId: string,
  nodeType: NodeType
): ApiExpression[] => {
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
    const position = (n.position as { x: number; y: number } | null) || positions[n.id] || { x: 0, y: 0 };
    return {
      id: n.id,
      type: 'custom' as const,
      position,
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

export const createNewNode = (
  graphId: string,
  nodeType: NodeType,
  existingNodes: AppFlowNode[]
): { appNode: AppFlowNode; defaultExprs: ApiExpression[] } => {
  const newNodeId = crypto.randomUUID();
  const nextIid = Math.max(...existingNodes.map(n => n.data?.node?.iid ?? 0), 0) + 1;
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

  return { appNode, defaultExprs };
};

export const getPrimaryInputExprId = (expressions: ApiExpression[]): string => {
  const baseInput = expressions.find(e => e.type === 'BASE_INPUT');
  const baseInputOutput = expressions.find(e => e.type === 'BASE_INPUT_OUTPUT');
  const subInputs = expressions.filter(e => e.type === 'SUB_INPUT').sort((a, b) => a.idx - b.idx);

  if (baseInput) return baseInput.id;
  if (baseInputOutput) return baseInputOutput.id;
  if (subInputs.length > 0) return subInputs[0].id;
  return '';
};

export const getPrimaryOutputExprId = (expressions: ApiExpression[]): string => {
  const baseOutput = expressions.find(e => e.type === 'BASE_OUTPUT');
  const baseInputOutput = expressions.find(e => e.type === 'BASE_INPUT_OUTPUT');
  const subOutputs = expressions.filter(e => e.type === 'SUB_OUTPUT').sort((a, b) => a.idx - b.idx);

  if (baseOutput) return baseOutput.id;
  if (baseInputOutput) return baseInputOutput.id;
  if (subOutputs.length > 0) return subOutputs[0].id;
  return '';
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
        label: NODE_LABELS[targetType],
      }
    }
  };
};

export const hasLeftHandle = (exprType: string): boolean => {
  return exprType === 'BASE_INPUT' || exprType === 'SUB_INPUT' || exprType === 'BASE_INPUT_OUTPUT';
};

export const hasRightHandle = (exprType: string): boolean => {
  return exprType === 'BASE_OUTPUT' || exprType === 'SUB_OUTPUT' || exprType === 'BASE_INPUT_OUTPUT';
};

