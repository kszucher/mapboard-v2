import type { BadgeProps } from '@radix-ui/themes';
import { Badge, Flex } from '@radix-ui/themes';
import { type NodeProps, useUpdateNodeInternals } from '@xyflow/react';
import { memo, useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/shallow';
import { useGraphStore } from '../store/useGraphStore';
import { FlowNodeActions } from './FlowNodeActions.tsx';
import { FlowNodeRow } from './FlowNodeRow.tsx';
import { NODE_PADDING } from './layout.ts';
import { type AppFlowNode, type NodeType } from './types.ts';


const NODE_COLORS: Record<NodeType, BadgeProps['color']> = {
  START: 'gray',
  END: 'gray',
  LOGIC: 'purple',
  AGENT: 'blue',
  LOGICAL_SWITCH: 'amber',
  AGENTIC_SWITCH: 'grass',
  LOGICAL_JOIN: 'teal',
  AGENTIC_JOIN: 'indigo',
};

const CustomNodeComponent = ({ data, id }: NodeProps<AppFlowNode>) => {
  const updateNodeInternals = useUpdateNodeInternals();

  const myExpressions = useGraphStore(
    useShallow(state => state.expressions.filter(e => e.node_id === id))
  );

  const myExpressionsHash = useMemo(() => {
    return myExpressions.map(e => `${e.id}:${e.idx}:${e.is_input}:${e.is_output}`).join(',');
  }, [myExpressions]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [myExpressionsHash, data.node.node_type, id, updateNodeInternals]);

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
        opacity: 1,
        transition: 'opacity 0.2s ease-in-out',
      }}
    >
      <Flex align="center" width="100%" height="24px" style={{ position: 'relative', gap: '6px' }}>
        <Flex direction="row" gap="1" align="center" flexGrow="1">
          <Badge color="gray" size="1" style={{ height: 'var(--space-5)' }}>
            {'N' + data.node.iid}
          </Badge>
          <Badge color={NODE_COLORS[data.node.node_type]} size="1" style={{ height: 'var(--space-5)' }}>
            {data.node.label}
          </Badge>
        </Flex>

        <div style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, paddingRight: '2px' }}>
          <FlowNodeActions nodeId={id}/>
        </div>
      </Flex>

      {myExpressions.map((expr) => {
        const disabled = isStart || isEnd;

        return (
          <FlowNodeRow
            key={expr.id}
            expressionId={expr.id}
            disabled={disabled}
            isStart={isStart}
            isEnd={isEnd}
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
