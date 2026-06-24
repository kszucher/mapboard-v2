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
}: BranchInputProps) => {
  // Direct pass-through since PlainEditor handles local state
  const localValue = value;

  return (
    <Flex gap="2" align="center" style={{ width: '100%' }}>
      <div className="nodrag nopan" style={{ flexGrow: 1, display: 'flex', alignItems: 'center' }}>
        <PlainEditor
          initialValue={localValue}
          onSave={onChange}
          singleLine={true}
          minWidth={100}
        />
      </div>

      <ExpressionActionsDropdown
        expressionId={expressionId}
        graphId={graphId}
        onMoveUp={onMoveUp}
        onMoveDown={onMoveDown}
        onDelete={onDelete}
        canMoveUp={canMoveUp}
        canMoveDown={canMoveDown}
      />
    </Flex>
  );
};
