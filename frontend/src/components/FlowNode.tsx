import type { BadgeProps } from '@radix-ui/themes';
import { Badge, Flex } from '@radix-ui/themes';
import { Handle, type NodeProps, Position, useUpdateNodeInternals } from '@xyflow/react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { NODE_PADDING } from '../store/layout';
import { useGraphStore } from '../store/useGraphStore';

import { FlowNodeActions } from './FlowNodeActions.tsx';
import { FlowNodeSlot } from './FlowNodeSlot.tsx';
import { type AppFlowNode, type NodeType } from './types.ts';


const NODE_COLORS: Record<NodeType, BadgeProps['color']> = {
  START: 'gray',
  END: 'gray',
  STEP: 'purple',
  SWITCH: 'amber',
};

const CustomNodeComponent = ({ data, id, selected }: NodeProps<AppFlowNode>) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const updateSlot = useGraphStore(state => state.updateSlot);

  const mySlots = data.node.slots;
  const isLoading = useGraphStore(state => state.isLoading);


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
      void updateSlot(mySlots[targetIndex].id, { selected: true });
    }
  }, [mySlots, updateSlot]);

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
        opacity: isLoading ? 0 : 1,
        transition: 'opacity 0.2s ease-in-out',
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

      {mySlots.map((slot) => {
        const disabled = isStart || isEnd;

        return (
          <FlowNodeSlot
            key={slot.id}
            slotId={slot.id}
            disabled={disabled}
            isStart={isStart}
            isEnd={isEnd}
            isSelected={!!slot.selected}
            onSelect={() => void updateSlot(slot.id, { selected: true })}
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
