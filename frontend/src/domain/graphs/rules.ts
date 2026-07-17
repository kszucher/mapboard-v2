import type { ApiSlot, NodeType } from '../../components/types';

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

export const canShortcircuitNode = (nodeType: NodeType): boolean => {
  return nodeType === 'STEP';
};
