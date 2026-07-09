import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from '@radix-ui/themes';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGraphStore } from '../store/useGraphStore';
import {
  canMoveExpressionDown,
  canMoveExpressionUp,
  computeTraversalIndices,
  getIncomingEdgeOptions,
  getOutgoingEdgeOptions
} from '../utils/flowUtils';
import type { InsertableNodeType } from './types';

const INSERTABLE_NODE_TYPES: { type: InsertableNodeType; label: string }[] = [
  { type: 'STEP', label: 'Step' },
  { type: 'BRANCH', label: 'Branch' },
  { type: 'MERGE', label: 'Merge' },
];

export interface ExpressionActionsContentProps {
  expressionId: string;
}

export const FlowNodeRowActionsContent = ({
  expressionId,
}: ExpressionActionsContentProps) => {
  const functions = useGraphStore(state => state.functions);
  const createExpression = useGraphStore(state => state.createExpression);
  const deleteExpression = useGraphStore(state => state.deleteExpression);
  const updateExpression = useGraphStore(state => state.updateExpression);
  const moveExpression = useGraphStore(state => state.moveExpression);
  const insertNode = useGraphStore(state => state.insertNode);
  const deleteEdge = useGraphStore(state => state.deleteEdge);

  const edges = useGraphStore(useShallow(state => state.edges));
  const nodes = useGraphStore(useShallow(state => state.nodes));

  const node = useMemo(() => {
    return nodes.find(n => n.data.node.expressions.some(e => e.id === expressionId));
  }, [nodes, expressionId]);

  const expr = useMemo(() => {
    return node?.data.node.expressions.find(e => e.id === expressionId);
  }, [node, expressionId]);

  const isInput = expr?.is_input ?? false;
  const isOutput = expr?.is_output ?? false;

  const myExpressions = useMemo(() => {
    return node ? node.data.node.expressions : [];
  }, [node]);

  const indexInNode = useMemo(() => {
    if (!expr) return -1;
    return myExpressions.findIndex(e => e.id === expressionId);
  }, [myExpressions, expressionId, expr]);

  const canMoveUp = useMemo(() => {
    if (indexInNode === -1) return false;
    return canMoveExpressionUp(indexInNode);
  }, [indexInNode]);

  const canMoveDown = useMemo(() => {
    if (indexInNode === -1) return false;
    return canMoveExpressionDown(indexInNode, myExpressions.length);
  }, [indexInNode, myExpressions.length]);

  const canDelete = useMemo(() => {
    return myExpressions.length > 1;
  }, [myExpressions]);

  const traversalIndexMap = useMemo(() => {
    return computeTraversalIndices(nodes);
  }, [nodes]);

  const outgoingEdgeOptions = useMemo(() => {
    return getOutgoingEdgeOptions(expressionId, edges, nodes, traversalIndexMap);
  }, [expressionId, edges, nodes, traversalIndexMap]);

  const incomingEdgeOptions = useMemo(() => {
    return getIncomingEdgeOptions(expressionId, edges, nodes, traversalIndexMap);
  }, [expressionId, edges, nodes, traversalIndexMap]);

  const hasOutgoingEdges = useMemo(() => {
    return edges.some(e => e.sourceHandle === expressionId);
  }, [edges, expressionId]);

  const hasIncomingEdges = useMemo(() => {
    return edges.some(e => e.targetHandle === expressionId);
  }, [edges, expressionId]);

  const handleInsert = useCallback(
    (nodeType: InsertableNodeType, direction: 'before' | 'after') => {
      void insertNode(expressionId, nodeType, direction);
    },
    [insertNode, expressionId]
  );

  const handleUpdateConnection = useCallback((isInputVal: boolean, isOutputVal: boolean) => {
    void updateExpression(expressionId, { is_input: isInputVal, is_output: isOutputVal });
  }, [expressionId, updateExpression]);

  const handleMoveTop = useCallback(() => {
    void moveExpression(expressionId, 'top');
  }, [expressionId, moveExpression]);

  const handleMoveUp = useCallback(() => {
    void moveExpression(expressionId, 'up');
  }, [expressionId, moveExpression]);

  const handleMoveDown = useCallback(() => {
    void moveExpression(expressionId, 'down');
  }, [expressionId, moveExpression]);

  const handleMoveBottom = useCallback(() => {
    void moveExpression(expressionId, 'bottom');
  }, [expressionId, moveExpression]);

  const handleDeleteItem = useCallback(() => {
    void deleteExpression(expressionId);
  }, [expressionId, deleteExpression]);

  const handleAddAbove = useCallback(() => {
    if (!expr || !node) return;
    void createExpression(node.id, expr.is_input, expr.is_output, indexInNode);
  }, [createExpression, node, expr, indexInNode]);

  const handleAddBelow = useCallback(() => {
    if (!expr || !node) return;
    void createExpression(node.id, expr.is_input, expr.is_output, indexInNode + 1);
  }, [createExpression, node, expr, indexInNode]);

  const renderInsertSubmenu = (direction: 'before' | 'after') => {
    const isAfter = direction === 'after';
    const label = isAfter ? 'Insert Node After' : 'Insert Node Before';
    const isAllowed = isAfter ? isOutput : isInput;
    return (
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger disabled={!isAllowed}>
          <PlusIcon style={{ marginRight: 8 }}/> {label}
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
          {INSERTABLE_NODE_TYPES.map(item => (
            <DropdownMenu.Item key={item.type} onClick={() => handleInsert(item.type, direction)}>
              {item.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
    );
  };

  const renderDeleteSubmenu = (direction: 'incoming' | 'outgoing') => {
    const isOutgoing = direction === 'outgoing';
    const label = isOutgoing ? 'Delete Outgoing Edge' : 'Delete Incoming Edge';
    const hasEdges = isOutgoing ? hasOutgoingEdges : hasIncomingEdges;
    const options = isOutgoing ? outgoingEdgeOptions : incomingEdgeOptions;
    return (
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger disabled={!hasEdges}>
          {label}
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
          {options.map(opt => (
            <DropdownMenu.Item
              key={opt.edgeId}
              onClick={() => {
                void deleteEdge(opt.edgeId);
              }}
              color="red"
            >
              {opt.label}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
    );
  };

  return (
    <>
      <DropdownMenu.Item onClick={() => handleUpdateConnection(true, true)}>
        {isInput && isOutput ? '✓ Input And Output' : '  Input And Output'}
      </DropdownMenu.Item>
      <DropdownMenu.Item onClick={() => handleUpdateConnection(true, false)}>
        {isInput && !isOutput ? '✓ Input Only' : '  Input Only'}
      </DropdownMenu.Item>
      <DropdownMenu.Item onClick={() => handleUpdateConnection(false, true)}>
        {!isInput && isOutput ? '✓ Output Only' : '  Output Only'}
      </DropdownMenu.Item>
      <DropdownMenu.Item onClick={() => handleUpdateConnection(false, false)}>
        {!isInput && !isOutput ? '✓ None' : '  None'}
      </DropdownMenu.Item>
      <DropdownMenu.Separator/>

      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger disabled={functions.length === 0}>
          {'Link Function'}
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
          <DropdownMenu.Item onClick={() => void updateExpression(expressionId, { function_id: null })}>
            {expr?.function_id === null || expr?.function_id === undefined ? '✓ None (Unlink)' : '  None (Unlink)'}
          </DropdownMenu.Item>
          <DropdownMenu.Separator />
          {functions.map(f => (
            <DropdownMenu.Item
              key={f.id}
              onClick={() => void updateExpression(expressionId, { function_id: f.id })}
            >
              {f.id === expr?.function_id ? `✓ ${f.name}` : `  ${f.name}`}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.SubContent>
      </DropdownMenu.Sub>
      <DropdownMenu.Separator/>

      <DropdownMenu.Item onClick={handleAddAbove}>
        <PlusIcon style={{ marginRight: 8 }}/> Add Expression Above
      </DropdownMenu.Item>
      <DropdownMenu.Item onClick={handleAddBelow}>
        <PlusIcon style={{ marginRight: 8 }}/> Add Expression Below
      </DropdownMenu.Item>
      <DropdownMenu.Separator/>

      <DropdownMenu.Item onClick={handleMoveTop} disabled={!canMoveUp}>
        <ArrowUpIcon style={{ marginRight: 8 }}/> Move to Top
      </DropdownMenu.Item>
      <DropdownMenu.Item onClick={handleMoveUp} disabled={!canMoveUp}>
        <ArrowUpIcon style={{ marginRight: 8 }}/> Move Up
      </DropdownMenu.Item>
      <DropdownMenu.Item onClick={handleMoveDown} disabled={!canMoveDown}>
        <ArrowDownIcon style={{ marginRight: 8 }}/> Move Down
      </DropdownMenu.Item>
      <DropdownMenu.Item onClick={handleMoveBottom} disabled={!canMoveDown}>
        <ArrowDownIcon style={{ marginRight: 8 }}/> Move to Bottom
      </DropdownMenu.Item>

      <DropdownMenu.Separator/>
      {renderInsertSubmenu('after')}
      {renderInsertSubmenu('before')}

      <DropdownMenu.Separator/>
      {renderDeleteSubmenu('outgoing')}
      {renderDeleteSubmenu('incoming')}

      <DropdownMenu.Separator/>
      <DropdownMenu.Item onClick={handleDeleteItem} color="red" disabled={!canDelete}>
        <TrashIcon style={{ marginRight: 8 }}/> Delete Expression
      </DropdownMenu.Item>
    </>
  );
};
