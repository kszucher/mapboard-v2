import type { components } from '../api/generated/schema';
import { getLayoutedElements } from '../components/layout';
import type { ApiNode, ApiSlot, AppFlowEdge, AppFlowNode, NodeType } from '../components/types';

type ApiEdge = components['schemas']['EdgeRead'];

export const NODE_LABELS: Record<NodeType, string> = {
  START: 'Start',
  END: 'End',
  STEP: 'Step',
  BRANCH: 'Branch',
  MERGE: 'Merge',
};

export const getAvailableConversions = (
  currentType: NodeType
): { targetType: NodeType; label: string }[] => {
  if (currentType === 'START' || currentType === 'END') {
    return [];
  }
  const allTypes: NodeType[] = [
    'STEP',
    'BRANCH',
    'MERGE',
  ];
  return allTypes
    .filter(t => t !== currentType)
    .map(t => ({
      targetType: t,
      label: NODE_LABELS[t],
    }));
};

export const createDefaultSlotsForNode = (
  nodeType: NodeType
): ApiSlot[] => {
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
  } else if (nodeType === 'STEP') {
    return [{
      id: baseId,
      is_input: true,
      is_output: true,
      raw_string: ''
    }];
  } else if (nodeType === 'BRANCH') {
    return [
      { id: baseId, is_input: true, is_output: false, raw_string: '' },
      { id: subId, is_input: false, is_output: true, raw_string: '' }
    ];
  } else if (nodeType === 'MERGE') {
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
  const slotToNodeId: Record<string, string> = {};
  nodes.forEach(n => {
    n.slots.forEach(s => {
      slotToNodeId[s.id] = n.id;
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
    .filter(edge => slotToNodeId[edge.from_slot_id] && slotToNodeId[edge.to_slot_id])
    .map(edge => {
      return {
        id: edge.id,
        source: slotToNodeId[edge.from_slot_id],
        target: slotToNodeId[edge.to_slot_id],
        sourceHandle: edge.from_slot_id,
        targetHandle: edge.to_slot_id,
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
  nodeType: NodeType
): AppFlowNode => {
  const newNodeId = crypto.randomUUID();
  const defaultSlots = createDefaultSlotsForNode(nodeType);

  const newNode: ApiNode = {
    id: newNodeId,
    node_type: nodeType,
    slots: defaultSlots,
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

export const canShortcircuitNode = (slots: ApiSlot[]): boolean => {
  const inputs = slots.filter(s => s.is_input);
  const outputs = slots.filter(s => s.is_output);
  return inputs.length === 1 && outputs.length === 1;
};

export const canMoveSlotUp = (index: number): boolean => {
  return index > 0;
};

export const canMoveSlotDown = (index: number, totalCount: number): boolean => {
  return index < totalCount - 1;
};

export const getPrimaryInputSlotId = (slots: ApiSlot[]): string => {
  const inputSlot = slots.find(s => s.is_input);
  return inputSlot ? inputSlot.id : '';
};

export const getPrimaryOutputSlotId = (slots: ApiSlot[]): string => {
  const outputSlot = slots.find(s => s.is_output);
  return outputSlot ? outputSlot.id : '';
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

export const computeTraversalIndices = (
  nodes: AppFlowNode[]
): Record<string, number> => {
  const startNode = nodes.find(n => n.data?.node?.node_type === 'START');
  const otherNodes = nodes.filter(n => n.data?.node?.node_type !== 'START');

  if (otherNodes.length === 0) {
    return startNode ? { [startNode.id]: 1 } : {};
  }

  // 1. Sort by starting x coordinate
  const sortedByX = [...otherNodes].sort((a, b) => a.position.x - b.position.x);

  // 2. Group overlapping horizontal intervals into columns
  const columns: AppFlowNode[][] = [];
  let currentColumnMaxRight = -Infinity;

  for (const node of sortedByX) {
    const width = node.measured?.width ?? 0;
    const left = node.position.x;
    const right = left + width;

    const lastCol = columns[columns.length - 1];
    if (!lastCol || left > currentColumnMaxRight) {
      // No overlap: start a new column
      columns.push([node]);
      currentColumnMaxRight = right;
    } else {
      // Overlap: add to the current column and update max right boundary
      lastCol.push(node);
      currentColumnMaxRight = Math.max(currentColumnMaxRight, right);
    }
  }

  // 3. Sort each column top-to-bottom by y coordinate
  for (const col of columns) {
    col.sort((a, b) => a.position.y - b.position.y);
  }

  // 4. Prepend START node
  const sortedNodeIds = startNode ? [startNode.id, ...columns.flat().map(n => n.id)] : columns.flat().map(n => n.id);

  return Object.fromEntries(sortedNodeIds.map((id, index) => [id, index + 1]));
};

export const formatSlotLabel = (
  nodeId: string | undefined,
  traversalIndexMap: Record<string, number>,
  slotIdx: number
): string => {
  const index = nodeId ? traversalIndexMap[nodeId] : undefined;
  return index !== undefined ? `N${index}-${slotIdx}` : `?-${slotIdx}`;
};

export interface EdgeOption {
  edgeId: string;
  label: string;
}

export const getOutgoingEdgeOptions = (
  slotId: string,
  edges: AppFlowEdge[],
  nodes: AppFlowNode[],
  traversalIndexMap: Record<string, number>
): EdgeOption[] => {
  const outgoingEdges = edges.filter(e => e.sourceHandle === slotId);
  return outgoingEdges.map(edge => {
    const targetNode = nodes.find(n => n.id === edge.target);
    const targetSlotIdx = targetNode ? targetNode.data.node.slots.findIndex(s => s.id === edge.targetHandle) : 0;
    return {
      edgeId: edge.id,
      label: formatSlotLabel(targetNode?.id, traversalIndexMap, targetSlotIdx >= 0 ? targetSlotIdx : 0),
    };
  });
};

export const getIncomingEdgeOptions = (
  slotId: string,
  edges: AppFlowEdge[],
  nodes: AppFlowNode[],
  traversalIndexMap: Record<string, number>
): EdgeOption[] => {
  const incomingEdges = edges.filter(e => e.targetHandle === slotId);
  return incomingEdges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const sourceSlotIdx = sourceNode ? sourceNode.data.node.slots.findIndex(s => s.id === edge.sourceHandle) : 0;
    return {
      edgeId: edge.id,
      label: formatSlotLabel(sourceNode?.id, traversalIndexMap, sourceSlotIdx >= 0 ? sourceSlotIdx : 0),
    };
  });
};
