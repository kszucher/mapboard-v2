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

export const getNextDownstreamNodeId = (
  currentNodeId: string,
  nodes: AppFlowNode[],
  edges: AppFlowEdge[]
): string | null => {
  const currentNode = nodes.find(n => n.id === currentNodeId);
  if (!currentNode) return null;

  const slots = currentNode.data.node.slots || [];
  for (const slot of slots) {
    const edge = edges.find(eg => eg.source === currentNodeId && eg.sourceHandle === slot.id);
    if (edge) return edge.target;
  }

  const nodeEdge = edges.find(eg => eg.source === currentNodeId && eg.sourceHandle === currentNodeId);
  if (nodeEdge) return nodeEdge.target;

  const anyEdge = edges.find(eg => eg.source === currentNodeId);
  return anyEdge ? anyEdge.target : null;
};

export const getNextUpstreamNodeId = (
  currentNodeId: string,
  _nodes: AppFlowNode[],
  edges: AppFlowEdge[]
): string | null => {
  const incomingEdge = edges.find(eg => eg.target === currentNodeId);
  return incomingEdge ? incomingEdge.source : null;
};

export const getSiblingNodeId = (
  currentNodeId: string,
  position: 'above' | 'below',
  nodes: AppFlowNode[],
  edges: AppFlowEdge[]
): string | null => {
  const currentNode = nodes.find(n => n.id === currentNodeId);
  if (!currentNode) return null;

  const parentSourceIds = edges.filter(eg => eg.target === currentNodeId).map(eg => eg.source);
  const childTargetIds = edges.filter(eg => eg.source === currentNodeId).map(eg => eg.target);

  const siblingNodes = nodes.filter(n => {
    if (n.id === currentNodeId) return false;
    const sharesParent = edges.some(eg => parentSourceIds.includes(eg.source) && eg.target === n.id);
    const sharesChild = edges.some(eg => childTargetIds.includes(eg.target) && eg.source === n.id);
    return sharesParent || sharesChild;
  }).sort((a, b) => a.position.y - b.position.y);

  if (siblingNodes.length === 0) return null;

  const currentY = currentNode.position.y;
  if (position === 'above') {
    const candidatesAbove = siblingNodes.filter(n => n.position.y < currentY);
    return candidatesAbove.length > 0 ? candidatesAbove[candidatesAbove.length - 1].id : null;
  }

  const candidatesBelow = siblingNodes.filter(n => n.position.y > currentY);
  return candidatesBelow.length > 0 ? candidatesBelow[0].id : null;
};
