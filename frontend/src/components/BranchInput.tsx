import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Flex, IconButton, TextField } from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';

interface BranchInputProps {
  value: string;
  onChange: (newValue: string) => void;
  onDelete: () => void;
  enableValidation?: boolean;
}

export const BranchInput = ({ value, onChange, onDelete, enableValidation }: BranchInputProps) => {
  const [localValue, setLocalValue] = useState(value);
  const lastSavedValueRef = useRef(value);

  // Sync local value when prop changes externally (not from our own save)
  useEffect(() => {
    // Only sync if the prop changed and it's different from what we last saved
    // This prevents syncing when the prop update came from our own onChange callback
    if (value !== lastSavedValueRef.current) {
      setLocalValue(value);
      lastSavedValueRef.current = value;
    }
  }, [value]);

  const isValid = (text: string) => {
    if (!text || !text.trim()) return false;
    return /^\s*state\.[a-zA-Z0-9_$]+\s*=/.test(text);
  };

  const showValidation = enableValidation && localValue.trim().length > 0;
  const valid = isValid(localValue);

  return (
    <Flex gap="2" align="center" style={{ marginLeft: 16 }}>
      <div className="nodrag" style={{ flexGrow: 1 }}>
        <TextField.Root
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={() => {
            if (localValue !== value) {
              lastSavedValueRef.current = localValue;
              onChange(localValue);
            }
          }}
          onKeyDown={e => {
            if (e.key === 'Enter') {
              e.currentTarget.blur(); // Trigger blur to save
            }
          }}
          style={{ flexGrow: 1, boxShadow: 'none' }}
        >
          <TextField.Slot side="right">
            {showValidation && (valid ? <CheckIcon color="green" /> : <Cross2Icon color="red" />)}
          </TextField.Slot>
        </TextField.Root>
      </div>
      <IconButton onClick={onDelete} size="1" variant="ghost" color="gray">
        <Cross2Icon />
      </IconButton>
    </Flex>
  );
};
