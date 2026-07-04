import { ArrowDownIcon, ArrowUpIcon, DotsHorizontalIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { DropdownMenu, IconButton } from '@radix-ui/themes';
import { useCallback, useMemo } from 'react';
import { useGraphStore } from '../store/useGraphStore';
import { canToggleExpressionPort } from '../utils/flowUtils';
import type { InsertableNodeType } from './types';

interface ExpressionActionsDropdownProps {
  expressionId: string;
  isInput: boolean;
  isOutput: boolean;
  triggerStyle?: React.CSSProperties;
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

export const FlowNodeExpressionActions = ({
  expressionId,
  isInput,
  isOutput,
  triggerStyle,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp = false,
  canMoveDown = false,
  onAddAbove,
  onAddBelow,
  canDelete = true,
  hideAddNode = false,
}: ExpressionActionsDropdownProps) => {
  const addConnectedNode = useGraphStore(state => state.addConnectedNode);
  const insertNodeBetween = useGraphStore(state => state.insertNodeBetween);
  const updateExpression = useGraphStore(state => state.updateExpression);
  const edges = useGraphStore(state => state.edges);
  const expressions = useGraphStore(state => state.expressions);

  const connectedEdge = useMemo(() => {
    return edges.find(e => e.sourceHandle === expressionId);
  }, [edges, expressionId]);

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
    <DropdownMenu.Root modal={false}>
      <DropdownMenu.Trigger>
        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          style={{ pointerEvents: 'auto', cursor: 'pointer', ...triggerStyle }}
          title="Expression Actions"
        >
          <DotsHorizontalIcon/>
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content onCloseAutoFocus={(e) => e.preventDefault()}>
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
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
