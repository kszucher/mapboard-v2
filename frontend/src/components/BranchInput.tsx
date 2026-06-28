import { Flex } from '@radix-ui/themes';
import { ExpressionActionsDropdown } from './ExpressionActionsDropdown';
import { PlainEditor } from './PlainEditor';

interface BranchInputProps {
  expressionId: string;
  graphId: string;
  value: string;
  onChange: (newValue: string) => void;
  onDelete: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  onAddAbove?: () => void;
  onAddBelow?: () => void;
  canDelete?: boolean;
}

export const BranchInput = ({
  expressionId,
  graphId,
  value,
  onChange,
  onDelete,
  onMoveUp,
  onMoveDown,
  canMoveUp = false,
  canMoveDown = false,
  onAddAbove,
  onAddBelow,
  canDelete = true,
}: BranchInputProps) => {
  // Direct pass-through since PlainEditor handles local state
  const localValue = value;

  return (
    <Flex gap="2" align="center" width="100%" height="100%">
      <Flex className="nodrag nopan" flexGrow="1" align="center" height="100%">
        <PlainEditor
          initialValue={localValue}
          onSave={onChange}
          minWidth={100}
        />
      </Flex>

      <ExpressionActionsDropdown
        expressionId={expressionId}
        graphId={graphId}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDelete={onDelete}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
        onAddAbove={onAddAbove}
        onAddBelow={onAddBelow}
        canDelete={canDelete}
      />
    </Flex>
  );
};
