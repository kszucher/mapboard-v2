import { ArrowDownIcon, ArrowUpIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { DropdownMenu } from '@radix-ui/themes';
import { useCallback, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useGraphStore } from '../store/useGraphStore';
import { canToggleExpressionPort } from '../utils/flowUtils';
import type { InsertableNodeType } from './types';

export interface ExpressionActionsContentProps {
  expressionId: string;
  isInput: boolean;
  isOutput: boolean;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onAddAbove?: () => void;
  onAddBelow?: () => void;
  canDelete?: boolean;
  hideAddNode?: boolean;
}

export const FlowNodeExpressionActionsContent = ({
  expressionId,
  isInput,
  isOutput,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp = false,
  canMoveDown = false,
  onAddAbove,
  onAddBelow,
  canDelete = true,
  hideAddNode = false,
}: ExpressionActionsContentProps) => {
  const addConnectedNode = useGraphStore(state => state.addConnectedNode);
  const insertNodeBetween = useGraphStore(state => state.insertNodeBetween);
  const updateExpression = useGraphStore(state => state.updateExpression);
  const reconnectEdge = useGraphStore(state => state.reconnectEdge);
  const deleteOutgoingEdge = useGraphStore(state => state.deleteOutgoingEdge);

  // Only this expression's own outgoing edge, not the whole edges array.
  const connectedEdge = useGraphStore(
    useShallow(state => state.edges.find(e => e.sourceHandle === expressionId))
  );

  const expressions = useGraphStore(useShallow(state => state.expressions));
  const edges = useGraphStore(useShallow(state => state.edges));
  const nodes = useGraphStore(useShallow(state => state.nodes));

  const reconnectOptions = useMemo(() => {
    return expressions
      .filter(expr => {
        if (!expr.is_input) return false;
        const hasIncoming = edges.some(edge => edge.targetHandle === expr.id);
        return !hasIncoming;
      })
      .map(expr => {
        const node = nodes.find(n => n.id === expr.node_id);
        return {
          expression: expr,
          node,
          label: node ? `N${node.data.node.iid}-${expr.idx}` : `?-${expr.idx}`,
        };
      })
      .sort((a, b) => {
        const aIid = a.node?.data.node.iid ?? 0;
        const bIid = b.node?.data.node.iid ?? 0;
        if (aIid !== bIid) return aIid - bIid;
        return a.expression.idx - b.expression.idx;
      });
  }, [expressions, edges, nodes]);

  const hasConnectedNode = !!connectedEdge;

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
    if (!canToggleExpressionPort(expressionId, 'is_input', !isInput, expressions)) {
      useGraphStore.setState({
        errorMessage: "Cannot toggle: expressions must follow the order: Inputs -> Both -> None -> Outputs."
      });
      return;
    }
    updateExpression(expressionId, { is_input: !isInput });
  }, [expressionId, isInput, expressions, updateExpression]);

  const handleToggleOutput = useCallback(() => {
    if (!canToggleExpressionPort(expressionId, 'is_output', !isOutput, expressions)) {
      useGraphStore.setState({
        errorMessage: "Cannot toggle: expressions must follow the order: Inputs -> Both -> None -> Outputs."
      });
      return;
    }
    updateExpression(expressionId, { is_output: !isOutput });
  }, [expressionId, isOutput, expressions, updateExpression]);

  return (
    <>
      {(onAddAbove || onAddBelow) && (
        <>
          {onAddAbove && (
            <DropdownMenu.Item onClick={onAddAbove}>
              <PlusIcon style={{ marginRight: 8 }}/> Add Expression Above
            </DropdownMenu.Item>
          )}
          {onAddBelow && (
            <DropdownMenu.Item onClick={onAddBelow}>
              <PlusIcon style={{ marginRight: 8 }}/> Add Expression Below
            </DropdownMenu.Item>
          )}
          <DropdownMenu.Separator/>
        </>
      )}

      {onMoveUp && (
        <>
          <DropdownMenu.Item onClick={onMoveUp} disabled={!canMoveUp}>
            <ArrowUpIcon style={{ marginRight: 8 }}/> Move Up
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={onMoveDown} disabled={!canMoveDown}>
            <ArrowDownIcon style={{ marginRight: 8 }}/> Move Down
          </DropdownMenu.Item>
          <DropdownMenu.Separator/>
        </>
      )}

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

              <DropdownMenu.Item
                onClick={() => {
                  void deleteOutgoingEdge(expressionId);
                }}
                color="red"
              >
                Delete Outgoing Edge
              </DropdownMenu.Item>
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

      {onDelete && (
        <>
          <DropdownMenu.Separator/>
          <DropdownMenu.Item onClick={onDelete} color="red" disabled={!canDelete}>
            <TrashIcon style={{ marginRight: 8 }}/> Delete Expression
          </DropdownMenu.Item>
        </>
      )}
    </>
  );
};
