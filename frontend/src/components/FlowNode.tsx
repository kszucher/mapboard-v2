import type { BadgeProps } from '@radix-ui/themes';
import { Badge, Flex } from '@radix-ui/themes';
import { type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { computeTraversalIndices } from '../utils/flowUtils';
import { FlowNodeActions } from './FlowNodeActions.tsx';
import { FlowNodeSlot } from './FlowNodeSlot.tsx';
import { NODE_PADDING } from './layout.ts';
import { type AppFlowNode, type NodeType } from './types.ts';


const NODE_COLORS: Record<NodeType, BadgeProps['color']> = {
  START: 'gray',
  END: 'gray',
  STEP: 'purple',
  BRANCH: 'amber',
  MERGE: 'teal',
};

const CustomNodeComponent = ({ data, id }: NodeProps<AppFlowNode>) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(null);

  const mySlots = data.node.slots;
  const isLoading = useGraphStore(state => state.isLoading);
  const traversalIndex = useGraphStore(
    useCallback(state => {
      const map = computeTraversalIndices(state.nodes);
      return map[id] ?? 1;
    }, [id])
  );

  const mySlotsHash = useMemo(() => {
    return mySlots.map((s, index) => `${s.id}:${index}:${s.is_input}:${s.is_output}`).join(',');
  }, [mySlots]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [mySlotsHash, data.node.node_type, id, updateNodeInternals]);

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
      setSelectedSlotId(mySlots[targetIndex].id);
    }
  }, [mySlots]);

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
      }}
    >
      <Flex align="center" width="100%" height="24px" style={{ position: 'relative', gap: '6px' }}>
        <Flex direction="row" gap="1" align="center" flexGrow="1">
          <Badge color="gray" size="1" style={{ height: 'var(--space-5)' }}>
            {'N' + traversalIndex}
          </Badge>
          <Badge color={NODE_COLORS[data.node.node_type]} size="1" style={{ height: 'var(--space-5)' }}>
            {data.node.node_type.charAt(0) + data.node.node_type.slice(1).toLowerCase()}
          </Badge>
        </Flex>

        <div style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, paddingRight: '2px' }}>
          <FlowNodeActions nodeId={id}/>
        </div>
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
            isSelected={selectedSlotId === slot.id}
            onSelect={() => setSelectedSlotId(slot.id)}
            onClearSelect={() => setSelectedSlotId(null)}
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
