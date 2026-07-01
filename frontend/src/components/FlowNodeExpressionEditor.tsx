import { TextField } from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';

interface PlainEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  actions?: React.ReactNode;
}

export const FlowNodeExpressionEditor = ({
  initialValue,
  onSave,
  disabled = false,
  actions,
}: PlainEditorProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(initialValue);
  const internalValueRef = useRef(initialValue);
  const isFocusedRef = useRef(false);

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (isFocusedRef.current) return;
    if (initialValue !== internalValueRef.current) {
      internalValueRef.current = initialValue;
      setValue(initialValue);
    }
  }, [initialValue]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/[\r\n]/g, '');
    internalValueRef.current = newValue;
    setValue(newValue);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      onSaveRef.current(newValue);
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      onSaveRef.current(value);
      inputRef.current?.blur();
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onSaveRef.current(value);
  };

  return (
    <div
      className="nodrag nopan"
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        width: '100%',
      }}
    >
      <TextField.Root
        ref={inputRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        disabled={disabled}
        color="gray"
        variant="soft"
        size="1"
        style={{
          fontFamily: 'Consolas, Menlo, Monaco, "Courier New", monospace',
          fontSize: '13px',
          width: '100%',
        }}
      >
        {actions && (
          <TextField.Slot side="right" pl="0" pr="1">
            {actions}
          </TextField.Slot>
        )}
      </TextField.Root>
    </div>
  );
};
