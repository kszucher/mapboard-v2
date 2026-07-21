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
  // Trace upstream to find the nearest ancestor node that has slots, and get the slot ID we came from
  const getBranchOrigin = (nodeId: string): { ancestorId: string; slotId: string } | null => {
    let curr = nodeId;
    while (curr) {
      const incoming = edges.find(e => e.target === curr);
      if (!incoming) return null;
      if (incoming.sourceHandle && incoming.sourceHandle !== incoming.source) {
        return { ancestorId: incoming.source, slotId: incoming.sourceHandle };
      }
      curr = incoming.source;
    }
    return null;
  };

  const myOrigin = getBranchOrigin(currentNodeId);
  if (!myOrigin) return null;

  // Sibling candidates are nodes that also trace back to the same ancestor, but a different slot
  const candidates = nodes
    .map(node => {
      const origin = getBranchOrigin(node.id);
      if (origin && origin.ancestorId === myOrigin.ancestorId && origin.slotId !== myOrigin.slotId) {
        const ancestorNode = nodes.find(n => n.id === myOrigin.ancestorId);
        const slots = ancestorNode?.data?.node?.slots || [];
        return {
          nodeId: node.id,
          slotIndex: slots.findIndex(s => s.id === origin.slotId)
        };
      }
      return null;
    })
    .filter((c): c is NonNullable<typeof c> => c !== null && c.slotIndex !== -1);

  const ancestorNode = nodes.find(n => n.id === myOrigin.ancestorId);
  const mySlotIndex = ancestorNode?.data?.node?.slots?.findIndex(s => s.id === myOrigin.slotId) ?? -1;

  if (position === 'above') {
    const candidatesAbove = candidates.filter(c => c.slotIndex < mySlotIndex);
    return candidatesAbove.sort((a, b) => b.slotIndex - a.slotIndex)[0]?.nodeId || null;
  } else {
    const candidatesBelow = candidates.filter(c => c.slotIndex > mySlotIndex);
    return candidatesBelow.sort((a, b) => a.slotIndex - b.slotIndex)[0]?.nodeId || null;
  }
};
