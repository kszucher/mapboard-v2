import { DotsHorizontalIcon } from '@radix-ui/react-icons';
import { DropdownMenu, IconButton } from '@radix-ui/themes';
import { memo, useState } from 'react';
import { FlowNodeSlotActionsContent } from './FlowNodeSlotActionsContent.tsx';

interface SlotActionsDropdownProps {
  slotId: string;
  triggerStyle?: React.CSSProperties;
}

export const FlowNodeSlotActions = memo(({
  slotId,
  triggerStyle,
}: SlotActionsDropdownProps) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <DropdownMenu.Root modal={false} onOpenChange={setDropdownOpen}>
      <DropdownMenu.Trigger>
        <IconButton
          size="1"
          variant="ghost"
          color="gray"
          style={{ pointerEvents: 'auto', cursor: 'pointer', ...triggerStyle }}
          title="Slot Actions"
        >
          <DotsHorizontalIcon/>
        </IconButton>
      </DropdownMenu.Trigger>
      <DropdownMenu.Content onCloseAutoFocus={(e) => e.preventDefault()}>
        {dropdownOpen && (
          <FlowNodeSlotActionsContent
            slotId={slotId}
          />
        )}
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
});
