import { DotsHorizontalIcon, ArrowUpIcon, ArrowDownIcon, TrashIcon, PlusIcon, MinusIcon } from '@radix-ui/react-icons'
import { Flex, IconButton, DropdownMenu } from '@radix-ui/themes'
import { CodeMirrorEditor } from './CodeMirrorEditor'

interface BranchInputProps {
  value: string;
  onChange: (newValue: string) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  hasConnectedNode?: boolean;
  onAddConnectedNode?: (nodeType: 'LOGIC' | 'AGENT' | 'LOGICAL_SWITCH' | 'AGENTIC_SWITCH') => void;
  onRemoveConnectedNode?: () => void;
}

export const BranchInput = ({
  value,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  hasConnectedNode = false,
  onAddConnectedNode,
  onRemoveConnectedNode,
}: BranchInputProps) => {
  // Direct pass-through since CodeMirrorEditor handles local state debouncing
  const localValue = value;

  return (
    <Flex gap="2" align="center" style={{ width: '100%' }}>
      <div className="nodrag" style={{ flexGrow: 1, display: 'flex' }}>
        <CodeMirrorEditor
          initialValue={localValue}
          onSave={onChange}
          singleLine={true}
          minHeight={32}
          minWidth={100}
        />
      </div>
      
      <DropdownMenu.Root>
        <DropdownMenu.Trigger>
          <IconButton
            size="1"
            variant="ghost"
            color="gray"
            style={{ pointerEvents: 'auto', cursor: 'pointer' }}
            title="Expression Actions"
          >
            <DotsHorizontalIcon />
          </IconButton>
        </DropdownMenu.Trigger>
        <DropdownMenu.Content onCloseAutoFocus={(e) => e.preventDefault()}>
          <DropdownMenu.Item onClick={onMoveUp} disabled={!canMoveUp}>
            <ArrowUpIcon style={{ marginRight: 8 }} /> Move Up
          </DropdownMenu.Item>
          <DropdownMenu.Item onClick={onMoveDown} disabled={!canMoveDown}>
            <ArrowDownIcon style={{ marginRight: 8 }} /> Move Down
          </DropdownMenu.Item>
          
          <DropdownMenu.Separator />
          
          {hasConnectedNode ? (
            <DropdownMenu.Item onClick={onRemoveConnectedNode} color="orange">
              <MinusIcon style={{ marginRight: 8 }} /> Remove Connected Node
            </DropdownMenu.Item>
          ) : (
            <DropdownMenu.Sub>
              <DropdownMenu.SubTrigger>
                <PlusIcon style={{ marginRight: 8 }} /> Add Connected Node
              </DropdownMenu.SubTrigger>
              <DropdownMenu.SubContent>
                <DropdownMenu.Item onClick={() => onAddConnectedNode?.('LOGIC')}>{'Logic'}</DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => onAddConnectedNode?.('AGENT')}>{'Agent'}</DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => onAddConnectedNode?.('LOGICAL_SWITCH')}>{'Logical Switch'}</DropdownMenu.Item>
                <DropdownMenu.Item onClick={() => onAddConnectedNode?.('AGENTIC_SWITCH')}>{'Agentic Switch'}</DropdownMenu.Item>
              </DropdownMenu.SubContent>
            </DropdownMenu.Sub>
          )}
          
          <DropdownMenu.Separator />
          
          <DropdownMenu.Item onClick={onDelete} color="red">
            <TrashIcon style={{ marginRight: 8 }} /> Delete Expression
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Root>
    </Flex>
  );
};
