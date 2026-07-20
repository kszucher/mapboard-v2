import type { AppFlowEdge, AppFlowNode } from '../../canvas/types';

export interface EdgeOption {
  edgeId: string;
  label: string;
}

export const getOutgoingEdgeOptions = (
  connectorId: string,
  edges: AppFlowEdge[],
  nodes: AppFlowNode[]
): EdgeOption[] => {
  const outgoingEdges = edges.filter(e => e.sourceHandle === connectorId);
  return outgoingEdges.map(edge => {
    const targetNode = nodes.find(n => n.id === edge.target);
    return {
      edgeId: edge.id,
      label: `To ${targetNode?.id || edge.target}`,
    };
  });
};

export const getIncomingEdgeOptions = (
  connectorId: string,
  edges: AppFlowEdge[],
  nodes: AppFlowNode[]
): EdgeOption[] => {
  const incomingEdges = edges.filter(e => e.targetHandle === connectorId);
  return incomingEdges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    return {
      edgeId: edge.id,
      label: `From ${sourceNode?.id || edge.source}`,
    };
  });
};

export const findParentNodeBySlotId = (
  slotId: string,
  nodes: AppFlowNode[]
): AppFlowNode | null => {
  return nodes.find(n => n.data.node.slots.some(s => s.id === slotId)) || null;
};
