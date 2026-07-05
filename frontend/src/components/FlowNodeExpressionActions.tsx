import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { DropdownMenu, IconButton } from '@radix-ui/themes';
import { memo, useState } from 'react';
import { FlowNodeExpressionActionsContent } from './FlowNodeExpressionActionsContent';

interface ExpressionActionsDropdownProps {
  expressionId: string;
  isInput: boolean;
  isOutput: boolean;
  triggerStyle?: React.CSSProperties;
}

export const FlowNodeExpressionActions = memo(({
  expressionId,
  isInput,
  isOutput,
  triggerStyle,
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
          />
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
});

FlowNodeExpressionActions.displayName = 'FlowNodeExpressionActions';
