import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons'
import { Flex, IconButton } from '@radix-ui/themes'
import { useCallback, useMemo } from 'react'
import { CodeMirrorEditor } from './CodeMirrorEditor'

interface BranchInputProps {
  value: string;
  onChange: (newValue: string) => void;
  onDelete: () => void;
  enableValidation?: boolean;
}

export const BranchInput = ({ value, onChange, onDelete, enableValidation }: BranchInputProps) => {
  // Direct pass-through since CodeMirrorEditor handles local state debouncing
  const localValue = value;

  const isValid = useCallback((text: string) => {
    if (!text || !text.trim()) return false;
    return /^\s*state\.[a-zA-Z0-9_$]+\s*=/.test(text);
  }, []);

  const showValidation = useMemo(() => enableValidation && localValue.trim().length > 0, [enableValidation, localValue]);
  const valid = useMemo(() => isValid(localValue), [localValue, isValid]);

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
        <div style={{ marginLeft: 8, display: 'flex', alignItems: 'center' }}>
          {showValidation && (valid ? <CheckIcon color="green" /> : <Cross2Icon color="red" />)}
        </div>
      </div>
      <IconButton onClick={onDelete} size="1" variant="ghost" color="gray">
        <Cross2Icon />
      </IconButton>
    </Flex>
  );
};
