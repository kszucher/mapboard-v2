import { Flex } from '@radix-ui/themes';
import { Handle, Position } from '@xyflow/react';
import { memo, useCallback } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { FlowNodeExpressionActions } from './FlowNodeExpressionActions.tsx';
import { FlowNodeExpressionEditor } from './FlowNodeExpressionEditor.tsx';
import { NODE_PADDING } from './layout.ts';

interface FlowNodeExpressionRowProps {
  expressionId: string;
  nodeId: string;
  canMoveUp: boolean;
  canMoveDown: boolean;
  canDelete: boolean;
  disabled: boolean;
  isStart: boolean;
  isEnd: boolean;
}

const FlowNodeExpressionRowComponent = ({
  expressionId,
  nodeId,
  canMoveUp,
  canMoveDown,
  canDelete,
  disabled,
  isStart,
  isEnd,
}: FlowNodeExpressionRowProps) => {
  // Subscribe to only this specific expression
  const expr = useGraphStore(
    useCallback(
      (state) => state.expressions.find((e) => e.id === expressionId),
      [expressionId]
    )
  );

  const createExpression = useGraphStore((state) => state.createExpression);
  const deleteExpression = useGraphStore((state) => state.deleteExpression);
  const updateExpression = useGraphStore((state) => state.updateExpression);
  const swapExpressionIndices = useGraphStore((state) => state.swapExpressionIndices);

  const handleUpdateItem = useCallback(
    (newValue: string) => {
      void updateExpression(expressionId, { raw_string: newValue });
    },
    [expressionId, updateExpression]
  );

  const handleDeleteItem = useCallback(() => {
    void deleteExpression(expressionId);
  }, [expressionId, deleteExpression]);

  const handleMoveUp = useCallback(() => {
    void swapExpressionIndices(expressionId, 'up');
  }, [expressionId, swapExpressionIndices]);

  const handleMoveDown = useCallback(() => {
    void swapExpressionIndices(expressionId, 'down');
  }, [expressionId, swapExpressionIndices]);

  const handleAddAbove = useCallback(() => {
    if (!expr) return;
    void createExpression(nodeId, expr.is_input, expr.is_output, expr.idx);
  }, [createExpression, nodeId, expr]);

  const handleAddBelow = useCallback(() => {
    if (!expr) return;
    void createExpression(nodeId, expr.is_input, expr.is_output, expr.idx + 1);
  }, [createExpression, nodeId, expr]);

  if (!expr) return null;

  const leftHandle = expr.is_input;
  const rightHandle = expr.is_output;

  const pl = leftHandle ? undefined : '5';
  const pr = rightHandle ? undefined : '5';

  const actions = !disabled ? (
    <FlowNodeExpressionActions
      expressionId={expr.id}
      isInput={leftHandle}
      isOutput={rightHandle}
      onMoveUp={handleMoveUp}
      onMoveDown={handleMoveDown}
      onDelete={handleDeleteItem}
      canMoveUp={canMoveUp}
      canMoveDown={canMoveDown}
      onAddAbove={handleAddAbove}
      onAddBelow={handleAddBelow}
      canDelete={canDelete}
      hideAddNode={!rightHandle}
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
        <FlowNodeExpressionEditor
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
};

export const FlowNodeExpressionRow = memo(FlowNodeExpressionRowComponent);
