import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { DropdownMenu, IconButton } from '@radix-ui/themes';
import { useState, memo } from 'react';
import { FlowNodeExpressionActionsContent } from './FlowNodeExpressionActionsContent';

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

export const FlowNodeExpressionActions = memo(({
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
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <DropdownMenu.Root modal={false} onOpenChange={setDropdownOpen}>
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
        {dropdownOpen && (
          <FlowNodeExpressionActionsContent
            expressionId={expressionId}
            isInput={isInput}
            isOutput={isOutput}
            onMoveUp={onMoveUp}
            onMoveDown={onMoveDown}
            onDelete={onDelete}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            onAddAbove={onAddAbove}
            onAddBelow={onAddBelow}
            canDelete={canDelete}
            hideAddNode={hideAddNode}
          />
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
});

FlowNodeExpressionActions.displayName = 'FlowNodeExpressionActions';
