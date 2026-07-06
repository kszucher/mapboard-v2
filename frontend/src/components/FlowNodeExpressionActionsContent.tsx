import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from '@radix-ui/themes';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGraphStore } from '../store/useGraphStore';
import {
  canMoveExpressionDown,
  canMoveExpressionUp,
  getAvailableReconnectOptions,
  getOutgoingEdgeOptions,
  getSortedNodeExpressions
} from '../utils/flowUtils';
import type { InsertableNodeType } from './types';

export interface ExpressionActionsContentProps {
  expressionId: string;
}

export const FlowNodeExpressionActionsContent = ({
  expressionId,
}: ExpressionActionsContentProps) => {
  const createExpression = useGraphStore(state => state.createExpression);
  const deleteExpression = useGraphStore(state => state.deleteExpression);
  const updateExpression = useGraphStore(state => state.updateExpression);
  const moveExpression = useGraphStore(state => state.moveExpression);
  const addConnectedNode = useGraphStore(state => state.addConnectedNode);
  const insertNodeBetween = useGraphStore(state => state.insertNodeBetween);
  const reconnectEdge = useGraphStore(state => state.reconnectEdge);
  const deleteOutgoingEdge = useGraphStore(state => state.deleteOutgoingEdge);

  const expressions = useGraphStore(useShallow(state => state.expressions));
  const edges = useGraphStore(useShallow(state => state.edges));
  const nodes = useGraphStore(useShallow(state => state.nodes));

  const expr = useMemo(() => expressions.find(e => e.id === expressionId), [expressions, expressionId]);

  const isInput = expr?.is_input ?? false;
  const isOutput = expr?.is_output ?? false;

  const myExpressions = useMemo(() => {
    if (!expr) return [];
    return getSortedNodeExpressions(expressions, expr.node_id);
  }, [expressions, expr]);

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

  const hideAddNode = !isOutput;

  // Only this expression's own outgoing edge, not the whole edges array.
  const connectedEdge = useGraphStore(
    useShallow(state => state.edges.find(e => e.sourceHandle === expressionId))
  );

  const reconnectOptions = useMemo(() => {
    return getAvailableReconnectOptions(expressions, edges, nodes);
  }, [expressions, edges, nodes]);

  const outgoingEdgeOptions = useMemo(() => {
    return getOutgoingEdgeOptions(expressionId, edges, expressions, nodes);
  }, [expressionId, edges, expressions, nodes]);

  const hasConnectedNode = outgoingEdgeOptions.length > 0;

  const handleAddConnectedNode = useCallback(
    (nodeType: InsertableNodeType) => {
      void addConnectedNode(expressionId, nodeType);
    },
    [addConnectedNode, expressionId]
  );

  const handleInsertNode = useCallback(
    (nodeType: InsertableNodeType) => {
      void insertNodeBetween(expressionId, nodeType);
    },
    [insertNodeBetween, expressionId]
  );

  const handleToggleInput = useCallback(() => {
    void updateExpression(expressionId, { is_input: !isInput });
  }, [expressionId, isInput, updateExpression]);

  const handleToggleOutput = useCallback(() => {
    void updateExpression(expressionId, { is_output: !isOutput });
  }, [expressionId, isOutput, updateExpression]);

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
    if (!expr) return;
    void createExpression(expr.node_id, expr.is_input, expr.is_output, expr.idx);
  }, [createExpression, expr]);

  const handleAddBelow = useCallback(() => {
    if (!expr) return;
    void createExpression(expr.node_id, expr.is_input, expr.is_output, expr.idx + 1);
  }, [createExpression, expr]);

  return (
    <>
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

      <DropdownMenu.Item onClick={handleToggleInput}>
        {isInput ? '✓ Input Handle' : '  Input Handle'}
      </DropdownMenu.Item>
      <DropdownMenu.Item onClick={handleToggleOutput}>
        {isOutput ? '✓ Output Handle' : '  Output Handle'}
      </DropdownMenu.Item>

      {!hideAddNode && (
        <>
          <DropdownMenu.Separator/>
          {hasConnectedNode ? (
            <>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>
                  <PlusIcon style={{ marginRight: 8 }}/> Add Interim Node
                </DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  <DropdownMenu.Item onClick={() => handleInsertNode('LOGIC')}>{'Logic'}</DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => handleInsertNode('AGENT')}>{'Agent'}</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={() => handleInsertNode('LOGICAL_SWITCH')}>{'Logical Switch'}</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={() => handleInsertNode('AGENTIC_SWITCH')}>{'Agentic Switch'}</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={() => handleInsertNode('LOGICAL_JOIN')}>{'Logical Join'}</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={() => handleInsertNode('AGENTIC_JOIN')}>{'Agentic Join'}</DropdownMenu.Item>
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>

              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>
                  Reconnect To
                </DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  {reconnectOptions.length === 0 ? (
                    <DropdownMenu.Item disabled>No available inputs</DropdownMenu.Item>
                  ) : (
                    reconnectOptions.map(opt => (
                      <DropdownMenu.Item
                        key={opt.expression.id}
                        onClick={() => {
                          if (connectedEdge) {
                            void reconnectEdge(connectedEdge.id, opt.expression.node_id, opt.expression.id);
                          }
                        }}
                      >
                        {opt.label}
                      </DropdownMenu.Item>
                    ))
                  )}
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>

              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>
                  Delete Outgoing Edge
                </DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  {outgoingEdgeOptions.map(opt => (
                    <DropdownMenu.Item
                      key={opt.edgeId}
                      onClick={() => {
                        void deleteOutgoingEdge(opt.edgeId);
                      }}
                      color="red"
                    >
                      {opt.label}
                    </DropdownMenu.Item>
                  ))}
                </DropdownMenu.SubContent>
              </DropdownMenu.Sub>
            </>
          ) : (
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger>
                <PlusIcon style={{ marginRight: 8 }}/> Add Node
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                <DropdownMenu.Item onClick={() => handleAddConnectedNode('LOGIC')}>{'Logic'}</DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => handleAddConnectedNode('AGENT')}>{'Agent'}</DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => handleAddConnectedNode('LOGICAL_SWITCH')}>{'Logical Switch'}</DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => handleAddConnectedNode('AGENTIC_SWITCH')}>{'Agentic Switch'}</DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => handleAddConnectedNode('LOGICAL_JOIN')}>{'Logical Join'}</DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => handleAddConnectedNode('AGENTIC_JOIN')}>{'Agentic Join'}</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          )}
        </>
      )}

      <DropdownMenu.Separator/>
      <DropdownMenu.Item onClick={handleDeleteItem} color="red" disabled={!canDelete}>
        <TrashIcon style={{ marginRight: 8 }}/> Delete Expression
      </DropdownMenu.Item>
    </>
  );
};
