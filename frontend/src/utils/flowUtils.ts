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
  nodeType: NodeType,
  nodeId: string
): ApiSlot[] => {
  if (nodeType === 'START') {
    return [];
  } else if (nodeType === 'END') {
    return [];
  } else if (nodeType === 'STEP') {
    return [];
  } else if (nodeType === 'SWITCH') {
    return [
      { id: `${nodeId}_option_a`, raw_string: 'option_a', selected: false },
      { id: `${nodeId}_option_b`, raw_string: 'option_b', selected: false }
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
  nodeType: NodeType,
  existingNodes: AppFlowNode[] = []
): AppFlowNode => {
  let newNodeId = '';
  if (nodeType === 'START') {
    newNodeId = 'start';
  } else if (nodeType === 'END') {
    newNodeId = 'end';
  } else {
    const prefix = nodeType.toLowerCase();
    let count = 1;
    while (existingNodes.some(n => n.id === `${prefix}_${count}`)) {
      count++;
    }
    newNodeId = `${prefix}_${count}`;
  }

  const defaultSlots = createDefaultSlotsForNode(nodeType, newNodeId);

  const newNode: ApiNode = {
    id: newNodeId,
    node_type: nodeType,
    is_input: nodeType !== 'START',
    is_output: nodeType === 'START' || nodeType === 'STEP',
    slots: defaultSlots,
    code: '',
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

export const getTemplateForNode = (node: ApiNode): string => {
  const nodeType = node.node_type;
  if (nodeType === 'STEP') {
    return 'def step_node(state: dict) -> dict:\n    # Write step logic here\n    return {}';
  }
  if (nodeType === 'SWITCH') {
    const slots = node.slots;
    if (slots.length === 0) {
      return `def switch_node(state: dict) -> str:\n    # Add output slots in the UI first\n    return ""`;
    }
    const lines = ['def switch_node(state: dict) -> str:'];
    slots.forEach((s, i) => {
      lines.push(`    ${i === 0 ? 'if' : 'elif'} True:`);
      lines.push(`        return "${s.raw_string}"`);
    });
    lines.push(`    return ""`);
    return lines.join('\n');
  }
  return '# Read-only node';
};

/**
 * Parses condition expressions from a switch_node function body.
 * Uses bracket-depth scanning to correctly identify the colon that ends
 * each if/elif condition — handles state['x'], {k: v}, slices, etc.
 * The only unsupported edge case is a bare `lambda x: ...` at the top level
 * of a condition, which is pathological in a routing context.
 */
export function parseSwitchConditions(code: string): Record<string, string> {
  const conditionMap: Record<string, string> = {};
  const lines = code.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const keywordMatch = line.match(/^    (if|elif) /);
    if (!keywordMatch) continue;

    const afterKeyword = line.slice(4 + keywordMatch[1].length + 1);

    // Scan for the top-level colon using bracket depth
    let depth = 0;
    let conditionEnd = -1;
    for (let j = 0; j < afterKeyword.length; j++) {
      const ch = afterKeyword[j];
      if (ch === '(' || ch === '[' || ch === '{') depth++;
      else if (ch === ')' || ch === ']' || ch === '}') depth--;
      else if (ch === ':' && depth === 0) {
        conditionEnd = j;
        break;
      }
    }
    if (conditionEnd === -1) continue;

    const condition = afterKeyword.slice(0, conditionEnd).trim();
    const nextLine = lines[i + 1]?.trim();
    const returnMatch = nextLine?.match(/^return\s+["']([^"']+)["']$/);
    if (returnMatch) {
      conditionMap[returnMatch[1]] = condition;
    }
  }

  return conditionMap;
}

export function syncSwitchCodeWithSlots(code: string, slots: any[]): string {
  if (!code) return '';

  const conditionMap = parseSwitchConditions(code);

  if (slots.length === 0) {
    return `def switch_node(state: dict) -> str:\n    # Add output slots in the UI first\n    return ""`;
  }

  const lines = ['def switch_node(state: dict) -> str:'];
  slots.forEach((slot, i) => {
    const label = slot.raw_string || `Slot ${i + 1}`;
    const cond = conditionMap[label] || 'True';
    lines.push(`    ${i === 0 ? 'if' : 'elif'} ${cond}:`);
    lines.push(`        return "${label}"`);
  });
  lines.push(`    return ""`);

  return lines.join('\n');
}

