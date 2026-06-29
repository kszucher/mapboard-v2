import { Flex, TextField } from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';

interface PlainEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  minWidth?: number;
  maxWidth?: number;
  actions?: React.ReactNode;
}

export const FlowNodeExpressionEditor = ({
  initialValue,
  onSave,
  disabled = false,
  minWidth = 240,
  maxWidth = 600,
  actions,
}: PlainEditorProps) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(initialValue);
  const internalValueRef = useRef(initialValue);
  const isFocusedRef = useRef(false);

  const spanRef = useRef<HTMLSpanElement>(null);
  const [measuredWidth, setMeasuredWidth] = useState<number>(minWidth);

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

  const hasActions = !!actions;

  useEffect(() => {
    const span = spanRef.current;
    if (!span) return;
    const textWidth = span.offsetWidth;
    const buffer = hasActions ? 60 : 24;
    const finalWidth = Math.max(minWidth, Math.min(textWidth + buffer, maxWidth));
    setMeasuredWidth(finalWidth);
  }, [value, minWidth, maxWidth, hasActions]);

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
    <Flex
      direction="column"
      className="nodrag nopan"
      onDoubleClick={(e) => e.stopPropagation()}
      width="100%"
      minWidth={`${measuredWidth}px`}
    >
      <span
        ref={spanRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'pre',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
        }}
      >
        {value || ' '}
      </span>

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
        style={{ fontFamily: 'var(--font-mono)', fontSize: '13px' }}
      >
        {actions && (
          <TextField.Slot side="right" pl="3" pr="1">
            {actions}
          </TextField.Slot>
        )}
      </TextField.Root>
    </Flex>
  );
};
