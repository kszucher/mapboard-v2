import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { DropdownMenu, IconButton } from '@radix-ui/themes';
import { memo, useState } from 'react';
import { FlowNodeRowActionsContent } from './FlowNodeRowActionsContent.tsx';

interface ExpressionActionsDropdownProps {
  expressionId: string;
  triggerStyle?: React.CSSProperties;
}

export const FlowNodeRowActions = memo(({
  expressionId,
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
          <FlowNodeRowActionsContent
            expressionId={expressionId}
          />
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
});
