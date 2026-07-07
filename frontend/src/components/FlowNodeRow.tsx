import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { memo, useCallback } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { FlowNodeRowActions } from './FlowNodeRowActions.tsx';
import { Editor } from './Editor.tsx';
import { NODE_PADDING } from './layout.ts';

interface FlowNodeRowProps {
  expressionId: string;
  disabled: boolean;
  isStart: boolean;
  isEnd: boolean;
}

export const FlowNodeRow = memo(({
  expressionId,
  disabled,
  isStart,
  isEnd,
}: FlowNodeRowProps) => {
  // Subscribe to only this specific expression
  const expr = useGraphStore(
    useCallback(
      (state) => state.expressions.find((e) => e.id === expressionId),
      [expressionId]
    )
  );

  const updateExpression = useGraphStore((state) => state.updateExpression);

  const handleUpdateItem = useCallback(
    (newValue: string) => {
      void updateExpression(expressionId, { raw_string: newValue });
    },
    [expressionId, updateExpression]
  );

  if (!expr) return null;

  const leftHandle = expr.is_input;
  const rightHandle = expr.is_output;

  const pl = leftHandle ? undefined : '5';
  const pr = rightHandle ? undefined : '5';

  const actions = !disabled ? (
    <FlowNodeRowActions
      expressionId={expr.id}
    />
  ) : undefined;

  const initialValue = (() => {
    if (isStart) return expr.raw_string || 'Start Node (Output)';
    if (isEnd) return expr.raw_string || 'End Node (Input)';
    return expr.raw_string;
  })();

  return (
    <Flex align="center" width="100%" height="24px" style={{ position: 'relative', gap: '6px' }}>
      {leftHandle && (
        <Handle
          type="target"
          id={expr.id}
          position={Position.Left}
          style={{ left: -NODE_PADDING }}
        />
      )}
      <Flex className="nodrag nopan" flexGrow="1" align="center" height="100%" pl={pl} pr={pr}>
        <Editor
          initialValue={initialValue}
          onSave={handleUpdateItem}
          disabled={disabled}
        />
      </Flex>
      {actions && (
        <div style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, paddingRight: '2px' }}>
          {actions}
        </div>
      )}
      {rightHandle && (
        <Handle
          type="source"
          id={expr.id}
          position={Position.Right}
          style={{ right: -NODE_PADDING }}
        />
      )}
    </Flex>
  );
});

