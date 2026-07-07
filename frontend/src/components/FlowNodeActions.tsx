import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { DropdownMenu, IconButton } from '@radix-ui/themes';
import { memo, useState } from 'react';
import { FlowNodeActionsContent } from './FlowNodeActionsContent.tsx';

interface FlowNodeActionsProps {
  nodeId: string;
  triggerStyle?: React.CSSProperties;
}

export const FlowNodeActions = memo(({ nodeId, triggerStyle }: FlowNodeActionsProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <DropdownMenu.Root modal={false} onOpenChange={setDropdownOpen}>
      <DropdownMenu.Trigger>
        <IconButton
          variant="ghost"
          size="1"
          color="gray"
          style={{ pointerEvents: 'auto', ...triggerStyle }}
        >
          <DotsHorizontalIcon/>
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content onCloseAutoFocus={e => e.preventDefault()}>
        {dropdownOpen && (
          <FlowNodeActionsContent nodeId={nodeId}/>
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
});
