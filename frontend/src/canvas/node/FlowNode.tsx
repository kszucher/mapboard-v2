import type { BadgeProps } from '@radix-ui/themes';
import { Badge, Flex } from '@radix-ui/themes';
import { Handle, type NodeProps, Position, useUpdateNodeInternals } from '@xyflow/react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { NODE_PADDING } from '../../domain/graph/layout';
import { useGraphStore } from '../../store/graphStore';
import { FlowNodeSlot } from '../slot/FlowNodeSlot.tsx';
import { type AppFlowNode, type NodeType } from '../types.ts';

import { FlowNodeActions } from './FlowNodeActions.tsx';


const NODE_COLORS: Record<NodeType, BadgeProps['color']> = {
  START: 'gray',
  END: 'gray',
  STEP: 'purple',
  SWITCH: 'amber',
};

const CustomNodeComponent = ({ data, id, selected }: NodeProps<AppFlowNode>) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const setSelectedIds = useGraphStore(state => state.setSelectedIds);

  const mySlots = data.node.slots;


  const mySlotsHash = useMemo(() => {
    return mySlots.map((s, index) => `${s.id}:${index}:${s.selected}`).join(',');
  }, [mySlots]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [mySlotsHash, data.node.node_type, data.node.is_input, data.node.is_output, id, updateNodeInternals]);

  const handleNavigateSlot = useCallback((currentSlotId: string, direction: 'up' | 'down') => {
    const currentIndex = mySlots.findIndex(s => s.id === currentSlotId);
    if (currentIndex === -1) return;

    let targetIndex = currentIndex;
    if (direction === 'up' && currentIndex > 0) {
      targetIndex = currentIndex - 1;
    } else if (direction === 'down' && currentIndex < mySlots.length - 1) {
      targetIndex = currentIndex + 1;
    }

    if (targetIndex !== currentIndex) {
      setSelectedIds(id, targetIndex);
    }
  }, [mySlots, id, setSelectedIds]);

  const { node } = data;
  const isStart = node.node_type === 'START';
  const isEnd = node.node_type === 'END';

  if (!data) return null;

  return (
    <Flex
      direction="column"
      style={{
        width: 'max-content',
        background: 'var(--gray-3)',
        borderRadius: 'var(--radius-3)',
        padding: NODE_PADDING,
        gap: NODE_PADDING,
        outline: selected ? '2px solid var(--accent-8)' : '1px solid var(--gray-5)',
        boxShadow: 'none',
      }}
    >
      <Flex align="center" width="100%" height="24px" style={{ position: 'relative', gap: '6px' }}>
        {data.node.is_input && (
          <Handle
            type="target"
            id={id}
            position={Position.Left}
            style={{ left: -NODE_PADDING }}
          />
        )}
        <Flex direction="row" gap="1" align="center" flexGrow="1">
          <Badge color={NODE_COLORS[data.node.node_type]} size="1" style={{ height: 'var(--space-5)' }}>
            {id}
          </Badge>
        </Flex>

        <div style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, paddingRight: '2px' }}>
          <FlowNodeActions nodeId={id}/>
        </div>
        {data.node.is_output && (
          <Handle
            type="source"
            id={id}
            position={Position.Right}
            style={{ right: -NODE_PADDING }}
          />
        )}
      </Flex>

      {mySlots.map((slot, index) => {
        const disabled = isStart || isEnd;

        return (
          <FlowNodeSlot
            key={slot.id}
            slotId={slot.id}
            disabled={disabled}
            isStart={isStart}
            isEnd={isEnd}
            isSelected={!!slot.selected}
            onSelect={() => setSelectedIds(id, index)}
            onNavigate={(direction) => handleNavigateSlot(slot.id, direction)}
          />
        );
      })}
    </Flex>
  );
};

export const CustomNode = memo(CustomNodeComponent, (prevProps, nextProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.dragging === nextProps.dragging &&
    prevProps.data === nextProps.data
  );
});
