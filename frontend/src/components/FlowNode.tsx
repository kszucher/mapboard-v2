import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import type { BadgeProps } from '@radix-ui/themes';
import { Badge, DropdownMenu, Flex, IconButton } from '@radix-ui/themes';
import { Handle, type NodeProps, Position, useUpdateNodeInternals } from '@xyflow/react';
import { memo, useCallback, useEffect, useMemo } from 'react';
import {
  useCreateExpression,
  useDeleteExpression,
  useDeleteNode,
  useMoveExpressionDown,
  useMoveExpressionUp,
  useShortcircuitNode,
  useUpdateExpression,
  useConvertNode,
} from '../api/mutations';

import { FlowNodeExpressionActions } from './FlowNodeExpressionActions.tsx';
import { FlowNodeExpressionEditor } from './FlowNodeExpressionEditor.tsx';
import type { ApiExpression, AppFlowNode, NodeType } from './types.ts';

const NODE_PADDING = 6;

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
  const deleteNodeMutation = useDeleteNode();
  const shortcircuitNodeMutation = useShortcircuitNode();
  const updateNodeInternals = useUpdateNodeInternals();

  const createExpression = useCreateExpression();
  const deleteExpression = useDeleteExpression();
  const updateExpression = useUpdateExpression();
  const moveExpressionUp = useMoveExpressionUp();
  const moveExpressionDown = useMoveExpressionDown();

  const myExpressions = useMemo(() => data.expressions ?? [], [data.expressions]);

  const myExpressionsHash = useMemo(() => {
    const sorted = [...myExpressions].sort((a, b) => a.idx - b.idx);
    return sorted.map(e => `${e.id}:${e.idx}`).join(',');
  }, [myExpressions]);

  useEffect(() => {
    updateNodeInternals(id);
  }, [myExpressionsHash, data.node.node_type, id, updateNodeInternals]);

  const handleDelete = useCallback(() => {
    deleteNodeMutation.mutate({ nodeId: data.node.id, graphId: data.node.graph_id });
  }, [data.node.id, data.node.graph_id, deleteNodeMutation]);

  const handleShortcircuit = useCallback(() => {
    shortcircuitNodeMutation.mutate({ nodeId: data.node.id, graphId: data.node.graph_id });
  }, [data.node.id, data.node.graph_id, shortcircuitNodeMutation]);

  const convertNodeMutation = useConvertNode();

  const conversionConfig = useMemo(() => {
    const type = data.node.node_type;
    const mappings: Record<NodeType, { targetType: NodeType; label: string } | null> = {
      AGENT: { targetType: 'LOGIC', label: 'Logic' },
      LOGIC: { targetType: 'AGENT', label: 'Agent' },
      AGENTIC_SWITCH: { targetType: 'TRANSFORM_AGENT_TO_LOGICAL', label: 'Transform Agent To Logical' },
      TRANSFORM_AGENT_TO_LOGICAL: { targetType: 'AGENTIC_SWITCH', label: 'Agentic Switch' },
      LOGICAL_SWITCH: { targetType: 'TRANSFORM_LOGICAL_TO_AGENT', label: 'Transform Logical to Agent' },
      TRANSFORM_LOGICAL_TO_AGENT: { targetType: 'LOGICAL_SWITCH', label: 'Logical Switch' },
      START: null,
      END: null,
      LOGICAL_JOIN: null,
      AGENTIC_JOIN: null,
    };
    return mappings[type] || null;
  }, [data.node.node_type]);

  const handleConvert = useCallback((targetType: NodeType) => {
    convertNodeMutation.mutate(
      { nodeId: data.node.id, targetType, graphId: data.node.graph_id },
      {
        onError: (err: any) => {
          const detail = err?.detail || err?.message || 'Unknown error occurred';
          alert(`Conversion failed: ${detail}`);
        },
      }
    );
  }, [data.node.id, data.node.graph_id, convertNodeMutation]);

  const { node } = data;
  const isStart = node.node_type === 'START';
  const isEnd = node.node_type === 'END';

  const subExpressionsCount = useMemo(() => {
    return myExpressions.filter(e => e.type.startsWith('SUB_')).length;
  }, [myExpressions]);

  const handleAddAbove = useCallback(
    (expr: ApiExpression) => {
      const newExpressionId = crypto.randomUUID();
      createExpression.mutate({
        nodeId: node.id,
        raw_string: '',
        graphId: node.graph_id,
        type: expr.type,
        expressionId: newExpressionId,
        idx: expr.idx,
      });
    },
    [createExpression, node.id, node.graph_id]
  );

  const handleAddBelow = useCallback(
    (expr: ApiExpression) => {
      const newExpressionId = crypto.randomUUID();
      createExpression.mutate({
        nodeId: node.id,
        raw_string: '',
        graphId: node.graph_id,
        type: expr.type,
        expressionId: newExpressionId,
        idx: expr.idx + 1,
      });
    },
    [createExpression, node.id, node.graph_id]
  );

  const handleUpdateItem = useCallback(
    (expr: ApiExpression, newValue: string) => {
      updateExpression.mutate({
        expressionId: expr.id,
        patch: { raw_string: newValue },
        graphId: node.graph_id,
      });
    },
    [updateExpression, node.graph_id]
  );

  const handleDeleteItem = useCallback(
    (expr: ApiExpression) => {
      deleteExpression.mutate({ expressionId: expr.id, graphId: node.graph_id });
    },
    [deleteExpression, node.graph_id]
  );

  const handleMoveUp = useCallback(
    (expr: ApiExpression) => {
      moveExpressionUp.mutate({ expressionId: expr.id, graphId: node.graph_id });
    },
    [moveExpressionUp, node.graph_id]
  );

  const handleMoveDown = useCallback(
    (expr: ApiExpression) => {
      moveExpressionDown.mutate({ expressionId: expr.id, graphId: node.graph_id });
    },
    [moveExpressionDown, node.graph_id]
  );

  if (!data) return null;

  return (
    <Flex
      direction="column"
      gap="1"
      minWidth="240px"
      style={{
        background: 'var(--gray-3)',
        borderRadius: 'var(--radius-3)',
        padding: NODE_PADDING,
        gap: NODE_PADDING,
        opacity: data.isPositioned ?? true ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out',
      }}
    >
      <Flex align="center" justify="between" width="100%" height="24px" style={{ position: 'relative' }}>
        <Flex direction="row" gap="1" align="center">
          <Badge color="gray" size="1" style={{ height: 'var(--space-5)' }}>
            {'N' + data.node.iid}
          </Badge>
          <Badge color={NODE_COLORS[data.node.node_type]} size="1" style={{ height: 'var(--space-5)' }}>
            {data.node.label}
          </Badge>
        </Flex>

        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger>
            <IconButton variant="soft" size="1" color="gray" style={{ pointerEvents: 'auto', background: 'none' }}>
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
            {!isStart && !isEnd && subExpressionsCount <= 1 && (
              <DropdownMenu.Item onClick={handleShortcircuit}>
                {'Shortcircuit'}
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item onClick={handleDelete}>
              {'Delete'}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Flex>

      {myExpressions.map((expr) => {
        const hasLeftHandle = expr.type === 'BASE_INPUT' || expr.type === 'SUB_INPUT' || expr.type === 'BASE_INPUT_OUTPUT';
        const hasRightHandle = expr.type === 'BASE_OUTPUT' || expr.type === 'SUB_OUTPUT' || expr.type === 'BASE_INPUT_OUTPUT';
        const isSub = expr.type.startsWith('SUB_');

        const pl = hasLeftHandle ? undefined : '5';
        const pr = hasRightHandle ? undefined : '5';

        // Same type expressions relative index calculations for sub expressions
        const sameTypeExprs = myExpressions.filter(e => e.type === expr.type).sort((a, b) => a.idx - b.idx);
        const relativeIndex = sameTypeExprs.findIndex(e => e.id === expr.id);
        const canMoveUp = relativeIndex > 0;
        const canMoveDown = relativeIndex < sameTypeExprs.length - 1;
        const canDelete = sameTypeExprs.length > 1;

        // Custom actions determination
        const actions = (() => {
          if (isSub) {
            return (
              <FlowNodeExpressionActions
                expressionId={expr.id}
                graphId={node.graph_id}
                onMoveUp={() => handleMoveUp(expr)}
                onMoveDown={() => handleMoveDown(expr)}
                onDelete={() => handleDeleteItem(expr)}
                canMoveUp={canMoveUp}
                canMoveDown={canMoveDown}
                onAddAbove={() => handleAddAbove(expr)}
                onAddBelow={() => handleAddBelow(expr)}
                canDelete={canDelete}
                hideAddNode={!hasRightHandle}
              />
            );
          } else if (hasRightHandle && !isEnd) {
            return (
              <FlowNodeExpressionActions
                expressionId={expr.id}
                graphId={node.graph_id}
              />
            );
          }
          return undefined;
        })();

        // Value placeholders
        const initialValue = (() => {
          if (isStart && expr.type === 'BASE_OUTPUT') return 'Start Node (Output)';
          if (isEnd && expr.type === 'BASE_INPUT') return 'End Node (Input)';
          return expr.raw_string;
        })();

        const disabled = isStart || isEnd;

        return (
          <Flex key={expr.id} align="center" width="100%" height="24px" style={{ position: 'relative' }}>
            {hasLeftHandle && (
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
                minWidth={isSub ? 100 : 240}
                maxWidth={isSub ? undefined : 600}
                actions={actions}
              />
            </Flex>
            {hasRightHandle && (
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
