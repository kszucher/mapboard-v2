import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { Flex, IconButton, TextField } from '@radix-ui/themes';
import { useEffect, useState } from 'react';

interface LogicAssignmentRowProps {
  value: string;
  onChange: (newValue: string) => void;
  onDelete: () => void;
}

export const LogicAssignmentRow = ({ value, onChange, onDelete }: LogicAssignmentRowProps) => {
  const [localValue, setLocalValue] = useState(value);

  useEffect(() => {
    setLocalValue(value);
  }, [value]);

  const handleBlur = () => {
    if (localValue !== value) {
      onChange(localValue);
    }
  };

  const isValid = (text: string) => {
    if (!text || !text.trim()) return false;
    return /^\s*state\.[a-zA-Z0-9_$]+\s*=/.test(text);
  };

  const showValidation = localValue.trim().length > 0;
  const valid = isValid(localValue);

  return (
    <Flex gap="2" align="center" style={{ marginLeft: 16 }}>
      <TextField.Root
        value={localValue}
        onChange={e => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={e => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        placeholder="Assignment"
        style={{ width: 240, boxShadow: 'none' }}
      >
        <TextField.Slot side="right">
          {showValidation && (valid ? <CheckIcon color="green" /> : <Cross2Icon color="red" />)}
        </TextField.Slot>
      </TextField.Root>

      <IconButton onClick={onDelete} size="1" variant="ghost" color="gray">
        <Cross2Icon />
      </IconButton>
    </Flex>
  );
};
