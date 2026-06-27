import { DotsHorizontalIcon, PlusIcon } from '@radix-ui/react-icons';
import type { BadgeProps } from '@radix-ui/themes';
import { Badge, Box, DropdownMenu, Flex, IconButton } from '@radix-ui/themes';
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

import { BranchInput } from './BranchInput.tsx';
import { ExpressionActionsDropdown } from './ExpressionActionsDropdown';
import { PlainEditor } from './PlainEditor';
import type { AppFlowNode } from './types.ts';

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
  const isSwitch = node.node_type === 'LOGICAL_SWITCH' || node.node_type === 'AGENTIC_SWITCH';

  const baseExpression = useMemo(() => {
    if (isStart) return null;
    if (isSwitch) {
      return myExpressions.find(e => e.type === 'BASE');
    }
    return myExpressions[0];
  }, [myExpressions, isSwitch, isStart]);

  const subExpressions = useMemo(() => {
    if (!isSwitch) return [];
    return myExpressions.filter(e => e.type === 'SUB').sort((a, b) => a.idx - b.idx);
  }, [myExpressions, isSwitch]);

  const handleAddItem = useCallback(() => {
    const newExpressionId = crypto.randomUUID();
    createExpression.mutate({
      nodeId: node.id,
      raw_string: '',
      graphId: node.graph_id,
      type: 'SUB',
      expressionId: newExpressionId,
    });
  }, [createExpression, node.id, node.graph_id]);

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

  const renderBody = useMemo(() => {
    if (isStart) {
      return (
        <>
          <Flex direction="column" gap="3" style={{ marginTop: 38 }}/>
          <Handle id="0" type="source" position={Position.Right}/>
        </>
      );
    }

    return (
      <Flex direction="column" gap="2" style={{ marginTop: 38, width: 'fit-content', minWidth: '100%' }}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Handle type="target" position={Position.Left} style={{ left: -12 }}/>
          {baseExpression && (
            <>
              <Flex gap="2" align="center" style={{ width: '100%' }}>
                <div className="nodrag nopan" style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
                  <PlainEditor
                    initialValue={baseExpression.raw_string}
                    onSave={handleUpdateBase}
                    minWidth={240}
                    maxWidth={600}
                  />
                </div>
                {!isSwitch && (
                  <ExpressionActionsDropdown
                    expressionId={baseExpression.id}
                    graphId={node.graph_id}
                  />
                )}
              </Flex>
              {!isSwitch && (
                <Handle
                  id={baseExpression.id}
                  type="source"
                  position={Position.Right}
                  style={{ right: -12 }}
                />
              )}
            </>
          )}
        </div>

        {isSwitch && subExpressions.length > 0 && (
          <Flex direction="column" gap="2" style={{ width: '100%', marginTop: 8 }}>
            {subExpressions.map((expr, i) => {
              return (
                <div key={expr.id} style={{ position: 'relative', width: '100%' }}>
                  <BranchInput
                    expressionId={expr.id}
                    graphId={node.graph_id}
                    value={expr.raw_string}
                    onChange={(newValue) => handleUpdateItem(i, newValue)}
                    onDelete={() => handleDeleteItem(i)}
                    onMoveUp={() => handleMoveUp(i)}
                    onMoveDown={() => handleMoveDown(i)}
                    canMoveUp={i > 0}
                    canMoveDown={i < subExpressions.length - 1}
                  />
                  <Handle
                    id={expr.id}
                    type="source"
                    position={Position.Right}
                    style={{ right: -12 }}
                  />
                </div>
              );
            })}
          </Flex>
        )}

        {isSwitch && (
          <Flex gap="2" align="center" style={{ height: 32, marginTop: 8 }}>
            <IconButton onClick={handleAddItem} size="1" variant="ghost" color="gray">
              <PlusIcon/>
            </IconButton>
          </Flex>
        )}
      </Flex>
    );
  }, [
    isStart,
    isSwitch,
    baseExpression,
    subExpressions,
    node,
    handleUpdateBase,
    handleUpdateItem,
    handleDeleteItem,
    handleMoveUp,
    handleMoveDown,
    handleAddItem,
  ]);

  if (!data) return null;

  const isLayoutReady = data.layer !== undefined;

  return (
    <div
      style={{
        background: '#222222',
        borderRadius: 16,
        padding: 12,
        minWidth: 200,
        minHeight: isStart ? 80 : undefined,
        opacity: isLayoutReady ? 1 : 0,
        transition: 'opacity 0.2s ease-in-out',
      }}
    >
      <Box position="absolute" top="8px" left="8px">
        <Flex direction="row" gap="4px" align="center">
          <Badge color={'gray'} size="2">
            {'N' + data.node.iid}
          </Badge>
          <Badge color={data.node.color as BadgeProps['color']} size="2">
            {data.node.label}
          </Badge>
        </Flex>
      </Box>

      <Box position="absolute" top="8px" right="8px">
        <DropdownMenu.Root modal={false}>
          <DropdownMenu.Trigger>
            <IconButton variant="soft" size="1" color="gray" style={{ pointerEvents: 'auto', background: 'none' }}>
              <DotsHorizontalIcon/>
            </IconButton>
          </DropdownMenu.Trigger>
          <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger>{'Connect To...'}</DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                <DropdownMenu.Item key={1}></DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
            {!isStart && !isSwitch && (
              <DropdownMenu.Item onClick={handleShortcircuit}>
                {'Shortcircuit'}
              </DropdownMenu.Item>
            )}
            <DropdownMenu.Item onClick={handleDelete}>
              {'Delete'}
            </DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Root>
      </Box>

      {renderBody}
    </div>
  );
};

export const CustomNode = memo(CustomNodeComponent);
