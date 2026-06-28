import { Box, TextField } from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';

interface PlainEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  minWidth?: number;
  maxWidth?: number;
}

export const PlainEditor = ({
  initialValue,
  onSave,
  minWidth = 240,
  maxWidth = 600,
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

  // Sync initialValue if it changes from outside and editor is not focused
  useEffect(() => {
    if (isFocusedRef.current) return;
    if (initialValue !== internalValueRef.current) {
      internalValueRef.current = initialValue;
      setValue(initialValue);
    }
  }, [initialValue]);

  // Adjust width dynamically based on text content length (local and instant)
  useEffect(() => {
    const span = spanRef.current;
    if (!span) return;
    const textWidth = span.offsetWidth;
    const buffer = 24;
    const finalWidth = Math.max(minWidth, Math.min(textWidth + buffer, maxWidth));
    setMeasuredWidth(finalWidth);
  }, [value, minWidth, maxWidth]);

  // Debounced save handler
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value.replace(/[\r\n]/g, '');
    internalValueRef.current = newValue;
    setValue(newValue);

    // Clear previous save timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Set new timer to save after 500ms of inactivity
    debounceTimerRef.current = setTimeout(() => {
      onSaveRef.current(newValue);
    }, 1000);
  };

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Force immediate save on Enter / commit
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
    // Force immediate save on blur
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    onSaveRef.current(value);
  };

  const commonStyles: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: '1.3',
    boxSizing: 'border-box',
  };

  return (
    <Box
      className="nodrag nopan"
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minWidth: `${measuredWidth}px`,
        boxSizing: 'border-box',
      }}
    >
      <span
        ref={spanRef}
        style={{
          position: 'absolute',
          visibility: 'hidden',
          whiteSpace: 'pre',
          fontFamily: 'var(--font-mono)',
          fontSize: '13px',
          letterSpacing: 'normal',
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
        color="gray"
        variant="soft"
        size="1"
        style={{
          ...commonStyles,
          width: '100%',
          height: '24px',
        }}
      />
    </Box>
  );
};
