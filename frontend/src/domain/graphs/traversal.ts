import type { AppFlowEdge, AppFlowNode } from '../../components/types';

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
    const isTargetNode = edge.targetHandle === edge.target;
    const targetSlot = targetNode?.data.node.slots.find(s => s.id === edge.targetHandle);

    let label = '';
    if (isTargetNode) {
      label = targetNode ? targetNode.id : '?';
    } else {
      label = targetNode && targetSlot ? `${targetNode.id} - ${targetSlot.raw_string}` : '?';
    }

    return {
      edgeId: edge.id,
      label,
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
    const isSourceNode = edge.sourceHandle === edge.source;
    const sourceSlot = sourceNode?.data.node.slots.find(s => s.id === edge.sourceHandle);

    let label = '';
    if (isSourceNode) {
      label = sourceNode ? sourceNode.id : '?';
    } else {
      label = sourceNode && sourceSlot ? `${sourceNode.id} - ${sourceSlot.raw_string}` : '?';
    }

    return {
      edgeId: edge.id,
      label,
    };
  });
};

export const findParentNodeBySlotId = (
  slotId: string,
  nodes: AppFlowNode[]
): AppFlowNode | null => {
  return nodes.find(n => n.data.node.slots.some(s => s.id === slotId)) || null;
};

export const getSlotIdByBranchIndex = (
  node: AppFlowNode,
  branchIndex: number
): string | null => {
  if (node.data?.node?.node_type !== 'SWITCH') return null;
  const slots = node.data.node.slots || [];
  return slots[branchIndex]?.id || null;
};
