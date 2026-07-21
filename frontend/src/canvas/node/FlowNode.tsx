import type { BadgeProps } from '@radix-ui/themes';
import { Badge, Flex } from '@radix-ui/themes';
import { Handle, type NodeProps, Position, useUpdateNodeInternals } from '@xyflow/react';
import { memo, useEffect, useMemo } from 'react';
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

const CustomNodeComponent = ({ data, id }: NodeProps<AppFlowNode>) => {
  const updateNodeInternals = useUpdateNodeInternals();
  const setSelectedIds = useGraphStore(state => state.setSelectedIds);
  const isNodeSelected = useGraphStore(state => state.selectedNodeId === id);
  const selectedSlotId = useGraphStore(state => state.selectedSlotId);

  const mySlotsHash = useMemo(() => {
    const slots = data?.node?.slots || [];
    return slots.map((s, index) => `${s.id}:${index}`).join(',');
  }, [data?.node?.slots]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [mySlotsHash, data?.node?.node_type, data?.node?.is_input, data?.node?.is_output, id, updateNodeInternals]);

  if (!data) return null;

  const { node } = data;
  const mySlots = node.slots || [];
  const isStart = node.node_type === 'START';
  const isEnd = node.node_type === 'END';

  // Strictly mutually exclusive: node outline ONLY shows when node is selected AND no slot is selected
  const isSelected = isNodeSelected && selectedSlotId === null;

  return (
    <Flex
      direction="column"
      style={{
        width: 'max-content',
        background: 'var(--gray-3)',
        borderRadius: 'var(--radius-3)',
        padding: NODE_PADDING,
        gap: NODE_PADDING,
        outline: isSelected ? '2px solid var(--accent-8)' : '1px solid var(--gray-5)',
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
            onSelect={() => setSelectedIds(id, index)}
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
