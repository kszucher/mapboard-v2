import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Flex, IconButton, TextField } from '@radix-ui/themes';
import { useCallback, useMemo } from 'react';
import { useDebouncedInput } from './hooks/useDebouncedInput.ts';

interface BranchInputProps {
  value: string;
  onChange: (newValue: string) => void;
  onDelete: () => void;
  enableValidation?: boolean;
}

export const BranchInput = ({ value, onChange, onDelete, enableValidation }: BranchInputProps) => {
  const { localValue, setLocalValue, handleBlur } = useDebouncedInput({ value, onChange });

  const isValid = useCallback((text: string) => {
    if (!text || !text.trim()) return false;
    return /^\s*state\.[a-zA-Z0-9_$]+\s*=/.test(text);
  }, []);

  const showValidation = useMemo(() => enableValidation && localValue.trim().length > 0, [enableValidation, localValue]);
  const valid = useMemo(() => isValid(localValue), [localValue, isValid]);

  return (
    <Flex gap="2" align="center" style={{ marginLeft: 16 }}>
      <div className="nodrag" style={{ flexGrow: 1 }}>
        <TextField.Root
          value={localValue}
          onChange={e => setLocalValue(e.target.value)}
          onBlur={handleBlur}
          onKeyDown={useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === 'Enter') {
              e.currentTarget.blur(); // Trigger blur to save
            }
          }, [])}
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
