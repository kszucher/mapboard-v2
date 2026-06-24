import { ArrowDownIcon, ArrowUpIcon, DotsHorizontalIcon, MinusIcon, PlusIcon, TrashIcon } from '@radix-ui/react-icons';
import { DropdownMenu, IconButton } from '@radix-ui/themes';
import { useCallback, useMemo } from 'react';
import { useAddConnectedNode, useDeleteNode } from '../api/mutations';
import { useEdges } from '../api/queries';

interface ExpressionActionsDropdownProps {
  expressionId: string;
  graphId: string;
  triggerStyle?: React.CSSProperties;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onDelete?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
}

export const ExpressionActionsDropdown = ({
  expressionId,
  graphId,
  triggerStyle,
  onMoveUp,
  onMoveDown,
  onDelete,
  canMoveUp = false,
  canMoveDown = false,
}: ExpressionActionsDropdownProps) => {
  const deleteNode = useDeleteNode();
  const addConnectedNode = useAddConnectedNode();
  const { data: allEdges } = useEdges(graphId);

  const connectedEdge = useMemo(() => {
    return allEdges?.find(e => e.from_expression_id === expressionId);
  }, [allEdges, expressionId]);

  const hasConnectedNode = !!connectedEdge;

  const handleRemoveConnectedNode = useCallback(() => {
    if (connectedEdge) {
      deleteNode.mutate({ nodeId: connectedEdge.to_node_id });
    }
  }, [connectedEdge, deleteNode]);

  const handleAddConnectedNode = useCallback(
    (nodeType: 'LOGIC' | 'AGENT' | 'LOGICAL_SWITCH' | 'AGENTIC_SWITCH') => {
      addConnectedNode.mutate({ expressionId, nodeType, graphId });
    },
    [addConnectedNode, expressionId, graphId]
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

        {hasConnectedNode ? (
          <DropdownMenu.Item onClick={handleRemoveConnectedNode} color="orange">
            <MinusIcon style={{ marginRight: 8 }}/> Remove Connected Node
          </DropdownMenu.Item>
        ) : (
          <DropdownMenu.Sub>
            <DropdownMenu.SubTrigger>
              <PlusIcon style={{ marginRight: 8 }}/> Add Connected Node
            </DropdownMenu.SubTrigger>
            <DropdownMenu.SubContent>
              <DropdownMenu.Item onClick={() => handleAddConnectedNode('LOGIC')}>{'Logic'}</DropdownMenu.Item>
              <DropdownMenu.Item onClick={() => handleAddConnectedNode('AGENT')}>{'Agent'}</DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => handleAddConnectedNode('LOGICAL_SWITCH')}>{'Logical Switch'}</DropdownMenu.Item>
              <DropdownMenu.Item
                onClick={() => handleAddConnectedNode('AGENTIC_SWITCH')}>{'Agentic Switch'}</DropdownMenu.Item>
            </DropdownMenu.SubContent>
          </DropdownMenu.Sub>
        )}

        {onDelete && (
          <>
            <DropdownMenu.Separator/>
            <DropdownMenu.Item onClick={onDelete} color="red">
              <TrashIcon style={{ marginRight: 8 }}/> Delete Expression
            </DropdownMenu.Item>
          </>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};
