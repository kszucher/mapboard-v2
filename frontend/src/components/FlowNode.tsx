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
} from '../api/mutations';

import { FlowNodeExpressionActions } from './FlowNodeExpressionActions.tsx';
import { FlowNodeExpressionEditor } from './FlowNodeExpressionEditor.tsx';
import type { AppFlowNode, NodeType } from './types.ts';

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

  const { node } = data;
  const isStart = node.node_type === 'START';
  const isEnd = node.node_type === 'END';
  const isSwitch = node.node_type === 'LOGICAL_SWITCH' || node.node_type === 'AGENTIC_SWITCH';
  const isJoin = node.node_type === 'LOGICAL_JOIN' || node.node_type === 'AGENTIC_JOIN';
  const isSwitchOrJoin = isSwitch || isJoin;

  const baseExpression = useMemo(() => {
    if (isSwitchOrJoin) {
      return myExpressions.find(e => e.type === 'BASE');
    }
    return myExpressions[0];
  }, [myExpressions, isSwitchOrJoin]);

  const subExpressions = useMemo(() => {
    if (!isSwitchOrJoin) return [];
    return myExpressions.filter(e => e.type === 'SUB').sort((a, b) => a.idx - b.idx);
  }, [myExpressions, isSwitchOrJoin]);

  const handleAddAbove = useCallback(
    (index: number) => {
      const expr = subExpressions[index];
      if (expr) {
        const newExpressionId = crypto.randomUUID();
        createExpression.mutate({
          nodeId: node.id,
          raw_string: '',
          graphId: node.graph_id,
          type: 'SUB',
          expressionId: newExpressionId,
          idx: expr.idx,
        });
      }
    },
    [subExpressions, createExpression, node.id, node.graph_id]
  );

  const handleAddBelow = useCallback(
    (index: number) => {
      const expr = subExpressions[index];
      if (expr) {
        const newExpressionId = crypto.randomUUID();
        createExpression.mutate({
          nodeId: node.id,
          raw_string: '',
          graphId: node.graph_id,
          type: 'SUB',
          expressionId: newExpressionId,
          idx: expr.idx + 1,
        });
      }
    },
    [subExpressions, createExpression, node.id, node.graph_id]
  );

  const handleUpdateBase = useCallback(
    (newValue: string) => {
      if (baseExpression) {
        updateExpression.mutate({
          expressionId: baseExpression.id,
          patch: { raw_string: newValue },
          graphId: node.graph_id,
        });
      }
    },
    [baseExpression, updateExpression, node.graph_id]
  );

  const handleUpdateItem = useCallback(
    (index: number, newValue: string) => {
      const expr = subExpressions[index];
      if (expr) {
        updateExpression.mutate({
          expressionId: expr.id,
          patch: { raw_string: newValue },
          graphId: node.graph_id,
        });
      }
    },
    [subExpressions, updateExpression, node.graph_id]
  );

  const handleDeleteItem = useCallback(
    (index: number) => {
      const expr = subExpressions[index];
      if (expr) {
        deleteExpression.mutate({ expressionId: expr.id, graphId: node.graph_id });
      }
    },
    [subExpressions, deleteExpression, node.graph_id]
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      const expr = subExpressions[index];
      if (expr) {
        moveExpressionUp.mutate({ expressionId: expr.id, graphId: node.graph_id });
      }
    },
    [subExpressions, moveExpressionUp, node.graph_id]
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      const expr = subExpressions[index];
      if (expr) {
        moveExpressionDown.mutate({ expressionId: expr.id, graphId: node.graph_id });
      }
    },
    [subExpressions, moveExpressionDown, node.graph_id]
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
            {!isStart && !isEnd && (!isSwitchOrJoin || subExpressions.length === 1) && (
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

      {isJoin && subExpressions.map((expr, i) => (
        <Flex key={expr.id} align="center" width="100%" height="24px" style={{ position: 'relative' }}>
          <Handle
            type="target"
            id={expr.id}
            position={Position.Left}
            style={{ left: -NODE_PADDING }}
          />
          <Flex className="nodrag nopan" flexGrow="1" align="center" height="100%">
            <FlowNodeExpressionEditor
              initialValue={expr.raw_string}
              onSave={(newValue) => handleUpdateItem(i, newValue)}
              minWidth={100}
              actions={
                <FlowNodeExpressionActions
                  expressionId={expr.id}
                  graphId={node.graph_id}
                  onMoveUp={() => handleMoveUp(i)}
                  onMoveDown={() => handleMoveDown(i)}
                  onDelete={() => handleDeleteItem(i)}
                  canMoveUp={i > 0}
                  canMoveDown={i < subExpressions.length - 1}
                  onAddAbove={() => handleAddAbove(i)}
                  onAddBelow={() => handleAddBelow(i)}
                  canDelete={subExpressions.length > 1}
                  hideAddNode={true}
                />
              }
            />
          </Flex>
        </Flex>
      ))}

      {baseExpression && (
        <Flex align="center" width="100%" height="24px" style={{ position: 'relative' }}>
          {!isJoin && !isStart && (
            <Handle
              id={baseExpression.id}
              type="target"
              position={Position.Left}
              style={{ left: -NODE_PADDING }}
            />
          )}
          <Flex className="nodrag nopan" flexGrow="1" align="center" height="100%" pl={isJoin ? '5' : undefined}>
            <FlowNodeExpressionEditor
              initialValue={isStart ? 'Start Node (Output)' : isEnd ? 'End Node (Input)' : baseExpression.raw_string}
              onSave={handleUpdateBase}
              disabled={isStart || isEnd}
              minWidth={240}
              maxWidth={600}
              actions={
                !isSwitch && !isEnd ? (
                  <FlowNodeExpressionActions
                    expressionId={baseExpression.id}
                    graphId={node.graph_id}
                  />
                ) : undefined
              }
            />
          </Flex>
          {(!isSwitch || isJoin) && !isEnd && (
            <Handle
              id={baseExpression.id}
              type="source"
              position={Position.Right}
              style={{ right: -NODE_PADDING }}
            />
          )}
        </Flex>
      )}

      {isSwitch && subExpressions.map((expr, i) => (
        <Flex key={expr.id} align="center" width="100%" height="24px" style={{ position: 'relative' }}>
          <Flex className="nodrag nopan" flexGrow="1" align="center" height="100%" pl="5">
            <FlowNodeExpressionEditor
              initialValue={expr.raw_string}
              onSave={(newValue) => handleUpdateItem(i, newValue)}
              minWidth={100}
              actions={
                <FlowNodeExpressionActions
                  expressionId={expr.id}
                  graphId={node.graph_id}
                  onMoveUp={() => handleMoveUp(i)}
                  onMoveDown={() => handleMoveDown(i)}
                  onDelete={() => handleDeleteItem(i)}
                  canMoveUp={i > 0}
                  canMoveDown={i < subExpressions.length - 1}
                  onAddAbove={() => handleAddAbove(i)}
                  onAddBelow={() => handleAddBelow(i)}
                  canDelete={subExpressions.length > 1}
                />
              }
            />
          </Flex>
          <Handle
            id={expr.id}
            type="source"
            position={Position.Right}
            style={{ right: -NODE_PADDING }}
          />
        </Flex>
      ))}
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
