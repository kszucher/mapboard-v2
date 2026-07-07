import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from '@radix-ui/themes';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGraphStore } from '../store/useGraphStore';
import {
  canMoveExpressionDown,
  canMoveExpressionUp,
  getIncomingEdgeOptions,
  getOutgoingEdgeOptions,
  getSortedNodeExpressions
} from '../utils/flowUtils';
import type { InsertableNodeType } from './types';

export interface ExpressionActionsContentProps {
  expressionId: string;
}

export const FlowNodeRowActionsContent = ({
  expressionId,
}: ExpressionActionsContentProps) => {
  const createExpression = useGraphStore(state => state.createExpression);
  const deleteExpression = useGraphStore(state => state.deleteExpression);
  const updateExpression = useGraphStore(state => state.updateExpression);
  const moveExpression = useGraphStore(state => state.moveExpression);
  const addConnectedNode = useGraphStore(state => state.addConnectedNode);
  const insertNodeAfter = useGraphStore(state => state.insertNodeAfter);
  const insertNodeBefore = useGraphStore(state => state.insertNodeBefore);
  const deleteEdge = useGraphStore(state => state.deleteEdge);

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

  const outgoingEdgeOptions = useMemo(() => {
    return getOutgoingEdgeOptions(expressionId, edges, expressions, nodes);
  }, [expressionId, edges, expressions, nodes]);

  const incomingEdgeOptions = useMemo(() => {
    return getIncomingEdgeOptions(expressionId, edges, expressions, nodes);
  }, [expressionId, edges, expressions, nodes]);

  const hasOutgoingEdges = useMemo(() => {
    return edges.some(e => e.sourceHandle === expressionId);
  }, [edges, expressionId]);

  const hasIncomingEdges = useMemo(() => {
    return edges.some(e => e.targetHandle === expressionId);
  }, [edges, expressionId]);

  const handleAddConnectedNode = useCallback(
    (nodeType: InsertableNodeType) => {
      void addConnectedNode(expressionId, nodeType);
    },
    [addConnectedNode, expressionId]
  );

  const handleInsertAfter = useCallback(
    (nodeType: InsertableNodeType) => {
      void insertNodeAfter(expressionId, nodeType);
    },
    [insertNodeAfter, expressionId]
  );

  const handleInsertBefore = useCallback(
    (nodeType: InsertableNodeType) => {
      void insertNodeBefore(expressionId, nodeType);
    },
    [insertNodeBefore, expressionId]
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
    if (!expr) return;
    void createExpression(expr.node_id, expr.is_input, expr.is_output, expr.idx);
  }, [createExpression, expr]);

  const handleAddBelow = useCallback(() => {
    if (!expr) return;
    void createExpression(expr.node_id, expr.is_input, expr.is_output, expr.idx + 1);
  }, [createExpression, expr]);

  return (
    <>
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger>
          Connection
        </DropdownMenu.SubTrigger>
        <DropdownMenu.SubContent>
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

      {isInput && hasIncomingEdges && (
        <>
          <DropdownMenu.Separator/>
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>
              <PlusIcon style={{ marginRight: 8 }}/> Insert Node Before
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              <DropdownMenu.Item onClick={() => handleInsertBefore('LOGIC')}>{'Logic'}</DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => handleInsertBefore('AGENT')}>{'Agent'}</DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => handleInsertBefore('LOGICAL_SWITCH')}>{'Logical Switch'}</DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => handleInsertBefore('AGENTIC_SWITCH')}>{'Agentic Switch'}</DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => handleInsertBefore('LOGICAL_JOIN')}>{'Logical Join'}</DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => handleInsertBefore('AGENTIC_JOIN')}>{'Agentic Join'}</DropdownMenu.Item>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>

          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>
              Delete Incoming Edge
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              {incomingEdgeOptions.map(opt => (
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
        </>
      )}

      {!hideAddNode && (
        <>
          <DropdownMenu.Separator/>
          {hasOutgoingEdges ? (
            <>
              <DropdownMenu.Sub>
                <DropdownMenu.SubTrigger>
                  <PlusIcon style={{ marginRight: 8 }}/> Insert Node After
                </DropdownMenu.SubTrigger>
                <DropdownMenu.SubContent>
                  <DropdownMenu.Item onClick={() => handleInsertAfter('LOGIC')}>{'Logic'}</DropdownMenu.Item>
                  <DropdownMenu.Item onClick={() => handleInsertAfter('AGENT')}>{'Agent'}</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={() => handleInsertAfter('LOGICAL_SWITCH')}>{'Logical Switch'}</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={() => handleInsertAfter('AGENTIC_SWITCH')}>{'Agentic Switch'}</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={() => handleInsertAfter('LOGICAL_JOIN')}>{'Logical Join'}</DropdownMenu.Item>
                  <DropdownMenu.Item
                    onClick={() => handleInsertAfter('AGENTIC_JOIN')}>{'Agentic Join'}</DropdownMenu.Item>
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
                        void deleteEdge(opt.edgeId);
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
