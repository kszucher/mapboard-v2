import { ArrowDownIcon, ArrowUpIcon, DotsHorizontalIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { DropdownMenu, IconButton } from '@radix-ui/themes';
import { useCallback, useMemo } from 'react';
import { useAddConnectedNode, useInsertNode } from '../api/mutations';
import { useGraphFlow } from '../api/queries';
import type { InsertableNodeType } from './types';


interface ExpressionActionsDropdownProps {
  expressionId: string;
  graphId: string;
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
  graphId,
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
  const addConnectedNode = useAddConnectedNode();
  const insertNode = useInsertNode();
  const { data: graphData } = useGraphFlow(graphId);

  const connectedEdge = useMemo(() => {
    return graphData?.edges?.find(e => e.from_expression_id === expressionId);
  }, [graphData?.edges, expressionId]);

  const hasConnectedNode = !!connectedEdge;

  const handleAddConnectedNode = useCallback(
    (nodeType: InsertableNodeType) => {
      addConnectedNode.mutate({ expressionId, nodeType, graphId });
    },
    [addConnectedNode, expressionId, graphId]
  );

  const handleInsertNode = useCallback(
    (nodeType: InsertableNodeType) => {
      insertNode.mutate({ expressionId, nodeType, graphId });
    },
    [insertNode, expressionId, graphId]
  );

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

        {!hideAddNode && (
          hasConnectedNode ? (
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
                <DropdownMenu.Item
                  onClick={() => handleInsertNode('TRANSFORM_AGENT_TO_LOGICAL')}>{'Transform Agent To Logical'}</DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => handleInsertNode('TRANSFORM_LOGICAL_TO_AGENT')}>{'Transform Logical To Agent'}</DropdownMenu.Item>
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
                <DropdownMenu.Item
                  onClick={() => handleAddConnectedNode('TRANSFORM_AGENT_TO_LOGICAL')}>{'Transform Agent To Logical'}</DropdownMenu.Item>
                <DropdownMenu.Item
                  onClick={() => handleAddConnectedNode('TRANSFORM_LOGICAL_TO_AGENT')}>{'Transform Logical To Agent'}</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          )
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
