import type { components } from '../api/generated/schema';
import { getLayoutedElements } from '../components/layout';
import type { ApiNode, ApiSlot, AppFlowEdge, AppFlowNode, NodeType } from '../components/types';

type ApiEdge = components['schemas']['EdgeRead'];

export const NODE_LABELS: Record<NodeType, string> = {
  START: 'Start',
  END: 'End',
  STEP: 'Step',
  SWITCH: 'Switch',
};

export const getAvailableConversions = (
  currentType: NodeType
): { targetType: NodeType; label: string }[] => {
  if (currentType === 'START' || currentType === 'END') {
    return [];
  }
  const allTypes: NodeType[] = [
    'STEP',
    'SWITCH',
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
    return [];
  } else if (nodeType === 'END') {
    return [];
  } else if (nodeType === 'STEP') {
    return [];
  } else if (nodeType === 'SWITCH') {
    return [
      { id: baseId, raw_string: '', selected: false },
      { id: subId, raw_string: '', selected: false }
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
      selected: n.selected ?? false,
      style: {
        transition: defaultTransition,
      },
      data: {
        node: n,
      },
    };
  });

  const rfEdges = edges
    .map(edge => {
      const sourceNodeId = edge.source_type === 'slot' ? slotToNodeId[edge.source_id] : edge.source_id;
      const targetNodeId = edge.target_type === 'slot' ? slotToNodeId[edge.target_id] : edge.target_id;

      if (!sourceNodeId || !targetNodeId) return null;

      return {
        id: edge.id,
        source: sourceNodeId,
        target: targetNodeId,
        sourceHandle: edge.source_id,
        targetHandle: edge.target_id,
        type: 'custom' as const,
        animated: true,
        data: {
          sections: [],
        },
      };
    })
    .filter((e): e is NonNullable<typeof e> => e !== null);

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

  let defaultCode = '';
  if (nodeType === 'STEP') {
    defaultCode = 'def step_node(state: dict) -> dict:\n    # Write step logic here\n    return {}';
  } else if (nodeType === 'SWITCH') {
    defaultCode = 'def switch_node(state: dict) -> str:\n    # Return target slot name (e.g. \'route_a\')\n    return ""';
  } else if (nodeType === 'START' || nodeType === 'END') {
    defaultCode = '# Read-only node';
  }

  const newNode: ApiNode = {
    id: newNodeId,
    node_type: nodeType,
    is_input: nodeType !== 'START',
    is_output: nodeType === 'START' || nodeType === 'STEP',
    slots: defaultSlots,
    code: defaultCode,
    selected: false,
  };

  return {
    id: newNodeId,
    type: 'custom',
    position: { x: 0, y: 0 },
    selected: false,
    style: {
      transition: 'transform 400ms cubic-bezier(0.4, 0, 0.2, 1)',
    },
    data: {
      node: newNode,
    }
  };
};

export const canShortcircuitNode = (nodeType: NodeType): boolean => {
  return nodeType === 'STEP';
};

export const canMoveSlotUp = (index: number): boolean => {
  return index > 0;
};

export const canMoveSlotDown = (index: number, totalCount: number): boolean => {
  return index < totalCount - 1;
};

export const getPrimaryInputHandleId = (node: ApiNode): string => {
  return node.id;
};

export const getPrimaryOutputHandleId = (node: ApiNode): string => {
  if (node.node_type === 'SWITCH' && node.slots.length > 0) {
    return node.slots[0].id;
  }
  return node.id;
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
  connectorId: string,
  edges: AppFlowEdge[],
  nodes: AppFlowNode[],
  traversalIndexMap: Record<string, number>
): EdgeOption[] => {
  const outgoingEdges = edges.filter(e => e.sourceHandle === connectorId);
  return outgoingEdges.map(edge => {
    const targetNode = nodes.find(n => n.id === edge.target);
    const isTargetNode = edge.targetHandle === edge.target;
    const targetSlotIdx = targetNode ? targetNode.data.node.slots.findIndex(s => s.id === edge.targetHandle) : -1;

    let label = '';
    if (isTargetNode) {
      const idx = targetNode ? traversalIndexMap[targetNode.id] : undefined;
      label = idx !== undefined ? `N${idx}` : `?`;
    } else {
      label = formatSlotLabel(targetNode?.id, traversalIndexMap, targetSlotIdx >= 0 ? targetSlotIdx : 0);
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
  nodes: AppFlowNode[],
  traversalIndexMap: Record<string, number>
): EdgeOption[] => {
  const incomingEdges = edges.filter(e => e.targetHandle === connectorId);
  return incomingEdges.map(edge => {
    const sourceNode = nodes.find(n => n.id === edge.source);
    const isSourceNode = edge.sourceHandle === edge.source;
    const sourceSlotIdx = sourceNode ? sourceNode.data.node.slots.findIndex(s => s.id === edge.sourceHandle) : -1;

    let label = '';
    if (isSourceNode) {
      const idx = sourceNode ? traversalIndexMap[sourceNode.id] : undefined;
      label = idx !== undefined ? `N${idx}` : `?`;
    } else {
      label = formatSlotLabel(sourceNode?.id, traversalIndexMap, sourceSlotIdx >= 0 ? sourceSlotIdx : 0);
    }

    return {
      edgeId: edge.id,
      label,
    };
  });
};

export const getTemplateForNode = (node: ApiNode): string => {
  const nodeType = node.node_type;
  if (nodeType === 'STEP') {
    return 'def step_node(state: dict) -> dict:\n    # Write step logic here\n    return {}';
  }
  if (nodeType === 'SWITCH') {
    const outputSlots = node.slots;
    if (outputSlots.length === 0) {
      return `def switch_node(state: dict) -> str:\n    # Add output slots in the UI first\n    return ""`;
    }
    if (outputSlots.length === 1) {
      return `def switch_node(state: dict) -> str:\n    if True:\n        return "${outputSlots[0].raw_string}"\n    return ""`;
    }
    if (outputSlots.length === 2) {
      return `def switch_node(state: dict) -> str:\n    if True:\n        return "${outputSlots[0].raw_string}"\n    else:  # cond: True\n        return "${outputSlots[1].raw_string}"`;
    }
    const middleElifs = outputSlots.slice(1, -1).map(s => `    elif True:\n        return "${s.raw_string}"`).join('\n');
    return `def switch_node(state: dict) -> str:\n    if True:\n        return "${outputSlots[0].raw_string}"\n${middleElifs}\n    else:  # cond: True\n        return "${outputSlots[outputSlots.length - 1].raw_string}"`;
  }
  return '# Read-only node';
};

export function syncSwitchCodeWithSlots(code: string, slots: any[]): string {
  if (!code) return '';

  const conditionMap: Record<string, string> = {};
  
  // Parse if/elif statements: if <cond>: \n return "label"
  const ifRegex = /(?:if|elif)\s+([^:]+):\s*\n\s*return\s+["']([^"']+)["']/g;
  let match;
  while ((match = ifRegex.exec(code)) !== null) {
    const condition = match[1].trim();
    const label = match[2];
    conditionMap[label] = condition;
  }

  // Parse else statements with comment: else: # cond: <cond> \n return "label"
  const elseRegex = /else:\s*#\s*cond:\s*([^\r\n]+)\s*\n\s*return\s+["']([^"']+)["']/g;
  while ((match = elseRegex.exec(code)) !== null) {
    const condition = match[1].trim();
    const label = match[2];
    conditionMap[label] = condition;
  }

  const outputSlots = slots;
  if (outputSlots.length === 0) {
    return `def switch_node(state: dict) -> str:\n    # Add output slots in the UI first\n    return ""`;
  }

  const lines = ["def switch_node(state: dict) -> str:"];

  if (outputSlots.length === 1) {
    const label = outputSlots[0].raw_string || 'Slot';
    const cond = conditionMap[label] || 'True';
    lines.push(`    if ${cond}:`);
    lines.push(`        return "${label}"`);
    lines.push(`    return ""`);
  } else if (outputSlots.length === 2) {
    const label1 = outputSlots[0].raw_string || 'Slot 1';
    const cond1 = conditionMap[label1] || 'True';
    const label2 = outputSlots[1].raw_string || 'Slot 2';
    const cond2 = conditionMap[label2] || 'True';
    
    lines.push(`    if ${cond1}:`);
    lines.push(`        return "${label1}"`);
    lines.push(`    else:  # cond: ${cond2}`);
    lines.push(`        return "${label2}"`);
  } else {
    const firstLabel = outputSlots[0].raw_string || 'Slot 1';
    const firstCond = conditionMap[firstLabel] || 'True';
    lines.push(`    if ${firstCond}:`);
    lines.push(`        return "${firstLabel}"`);
    
    for (let i = 1; i < outputSlots.length - 1; i++) {
      const label = outputSlots[i].raw_string || `Slot ${i + 1}`;
      const cond = conditionMap[label] || 'True';
      lines.push(`    elif ${cond}:`);
      lines.push(`        return "${label}"`);
    }
    
    const lastLabel = outputSlots[outputSlots.length - 1].raw_string || `Slot ${outputSlots.length}`;
    const lastCond = conditionMap[lastLabel] || 'True';
    lines.push(`    else:  # cond: ${lastCond}`);
    lines.push(`        return "${lastLabel}"`);
  }

  return lines.join('\n');
}
