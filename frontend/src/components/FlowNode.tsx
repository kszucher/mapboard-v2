import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import type { BadgeProps } from '@radix-ui/themes';
import { Badge, DropdownMenu, Flex, IconButton } from '@radix-ui/themes';
import { Handle, type NodeProps, Position, useUpdateNodeInternals } from '@xyflow/react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import { NODE_CONVERSIONS, isValidOrder } from '../utils/flowUtils';
import { useGraphStore } from '../store/useGraphStore';
import { FlowNodeExpressionActions } from './FlowNodeExpressionActions.tsx';
import { FlowNodeExpressionEditor } from './FlowNodeExpressionEditor.tsx';
import { NODE_PADDING } from './layout.ts';
import { type ApiExpression, type AppFlowNode, type NodeType } from './types.ts';


const NODE_COLORS: Record<NodeType, BadgeProps['color']> = {
  START: 'gray',
  END: 'gray',
  LOGIC: 'purple',
  AGENT: 'blue',
  LOGICAL_SWITCH: 'amber',
  AGENTIC_SWITCH: 'grass',
  LOGICAL_JOIN: 'teal',
  AGENTIC_JOIN: 'indigo',
  TRANSFORM_AGENT_TO_LOGICAL: 'ruby',
  TRANSFORM_LOGICAL_TO_AGENT: 'plum',
};

const CustomNodeComponent = ({ data, id }: NodeProps<AppFlowNode>) => {
  const deleteNode = useGraphStore(state => state.deleteNode);
  const shortcircuitNode = useGraphStore(state => state.shortcircuitNode);
  const convertNode = useGraphStore(state => state.convertNode);
  const createExpression = useGraphStore(state => state.createExpression);
  const deleteExpression = useGraphStore(state => state.deleteExpression);
  const updateExpression = useGraphStore(state => state.updateExpression);
  const swapExpressionIndices = useGraphStore(state => state.swapExpressionIndices);

  const updateNodeInternals = useUpdateNodeInternals();

  const myExpressions = useMemo(() => data.expressions ?? [], [data.expressions]);

  const myExpressionsHash = useMemo(() => {
    const sorted = [...myExpressions].sort((a, b) => a.idx - b.idx);
    return sorted.map(e => `${e.id}:${e.idx}:${e.is_input}:${e.is_output}`).join(',');
  }, [myExpressions]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [myExpressionsHash, data.node.node_type, id, updateNodeInternals]);

  const handleDelete = useCallback(() => {
    void deleteNode(data.node.id);
  }, [data.node.id, deleteNode]);

  const handleShortcircuit = useCallback(() => {
    void shortcircuitNode(data.node.id);
  }, [data.node.id, shortcircuitNode]);

  const conversionConfig = NODE_CONVERSIONS[data.node.node_type];

  const handleConvert = useCallback((targetType: NodeType) => {
    void convertNode(data.node.id, targetType);
  }, [data.node.id, convertNode]);

  const { node } = data;
  const isStart = node.node_type === 'START';
  const isEnd = node.node_type === 'END';

  const canShortcircuit = useMemo(() => {
    const inputs = myExpressions.filter(e => e.is_input);
    const outputs = myExpressions.filter(e => e.is_output);
    return inputs.length === 1 && outputs.length === 1;
  }, [myExpressions]);

  const handleAddAbove = useCallback(
    (expr: ApiExpression) => {
      void createExpression(node.id, expr.is_input, expr.is_output, expr.idx);
    },
    [createExpression, node.id]
  );

  const handleAddBelow = useCallback(
    (expr: ApiExpression) => {
      void createExpression(node.id, expr.is_input, expr.is_output, expr.idx + 1);
    },
    [createExpression, node.id]
  );

  const handleUpdateItem = useCallback(
    (expr: ApiExpression, newValue: string) => {
      updateExpression(expr.id, { raw_string: newValue });
    },
    [updateExpression]
  );

  const handleDeleteItem = useCallback(
    (expr: ApiExpression) => {
      void deleteExpression(expr.id);
    },
    [deleteExpression]
  );

  const handleMoveUp = useCallback(
    (expr: ApiExpression) => {
      void swapExpressionIndices(expr.id, 'up');
    },
    [swapExpressionIndices]
  );

  const handleMoveDown = useCallback(
    (expr: ApiExpression) => {
      void swapExpressionIndices(expr.id, 'down');
    },
    [swapExpressionIndices]
  );

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
        opacity: data.isPositioned ?? true ? 1 : 0,
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
          <DropdownMenu.Root modal={false}>
            <DropdownMenu.Trigger>
              <IconButton variant="ghost" size="1" color="gray" style={{ pointerEvents: 'auto' }}>
                <DotsHorizontalIcon/>
              </IconButton>
            </DropdownMenu.Trigger>
          <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
            {conversionConfig && (
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>
                  {'Convert'}
                </DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  <DropdownMenu.Item onClick={() => handleConvert(conversionConfig.targetType)}>
                    {conversionConfig.label}
                  </DropdownMenu.Item>
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
            )}
            {!isStart && !isEnd && canShortcircuit && (
              <DropdownMenu.Item onClick={handleShortcircuit}>
                {'Shortcircuit'}
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item onClick={handleDelete}>
              {'Delete'}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
        </div>
      </Flex>

      {myExpressions.map((expr, index) => {
        const leftHandle = expr.is_input;
        const rightHandle = expr.is_output;

        const pl = leftHandle ? undefined : '5';
        const pr = rightHandle ? undefined : '5';

        // Same type expressions relative index calculations for sub expressions
        const canMoveUp = (() => {
          if (index === 0) return false;
          const test = [...myExpressions];
          const tmp = test[index];
          test[index] = test[index - 1];
          test[index - 1] = tmp;
          return isValidOrder(test);
        })();

        const canMoveDown = (() => {
          if (index === myExpressions.length - 1) return false;
          const test = [...myExpressions];
          const tmp = test[index];
          test[index] = test[index + 1];
          test[index + 1] = tmp;
          return isValidOrder(test);
        })();

        const canDelete = myExpressions.length > 1;

        const disabled = isStart || isEnd;

        // Custom actions determination
        const actions = !disabled ? (
          <FlowNodeExpressionActions
            expressionId={expr.id}
            isInput={leftHandle}
            isOutput={rightHandle}
            onMoveUp={() => handleMoveUp(expr)}
            onMoveDown={() => handleMoveDown(expr)}
            onDelete={() => handleDeleteItem(expr)}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onAddAbove={() => handleAddAbove(expr)}
            onAddBelow={() => handleAddBelow(expr)}
            canDelete={canDelete}
            hideAddNode={!rightHandle}
          />
        ) : undefined;

        // Value placeholders
        const initialValue = (() => {
          if (isStart) return expr.raw_string || 'Start Node (Output)';
          if (isEnd) return expr.raw_string || 'End Node (Input)';
          return expr.raw_string;
        })();

        return (
          <Flex key={expr.id} align="center" width="100%" height="24px" style={{ position: 'relative', gap: '6px' }}>
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
                onSave={(newValue) => handleUpdateItem(expr, newValue)}
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
      })}
    </Flex>
  );
};

export const CustomNode = memo(CustomNodeComponent, (prevProps, nextProps) => {
  return (
    prevProps.id === nextProps.id &&
    prevProps.selected === nextProps.selected &&
    prevProps.dragging === nextProps.dragging &&
    JSON.stringify(prevProps.data) === JSON.stringify(nextProps.data)
  );
});
