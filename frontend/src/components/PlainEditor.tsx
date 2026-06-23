import { TextField, TextArea, Box } from '@radix-ui/themes';
import { useEffect, useRef, useState } from 'react';

interface PlainEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  minWidth?: number;
  maxWidth?: number;
  minHeight?: number;
  singleLine?: boolean;
}

export const PlainEditor = ({
  initialValue,
  onSave,
  minWidth = 240,
  maxWidth = 600,
  minHeight = 24, // Matches the size="1" Radix button height (24px)
  singleLine = false,
}: PlainEditorProps) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
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

  // Adjust width dynamically based on text content length
  useEffect(() => {
    const span = spanRef.current;
    if (!span) return;

    // Read the width of the span
    const textWidth = span.offsetWidth;
    // Add a small buffer (e.g. 24px) for the cursor and padding
    const buffer = 24;
    const finalWidth = Math.max(minWidth, Math.min(textWidth + buffer, maxWidth));
    setMeasuredWidth(finalWidth);
  }, [value, minWidth, maxWidth]);

  // Adjust height dynamically based on content scroll height (for multiline)
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea || singleLine) return;

    const numLines = value.split('\n').length;
    if (numLines <= 1) {
      textarea.style.height = `${minHeight}px`;
    } else {
      textarea.style.height = 'auto';
      // Set actual height based on scrollHeight + border (2px)
      const targetHeight = textarea.scrollHeight + 2;
      textarea.style.height = `${Math.max(targetHeight, minHeight)}px`;
    }
  }, [value, minHeight, singleLine, measuredWidth]); // Re-run when width changes to ensure proper wrap height

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    let newValue = e.target.value;
    if (singleLine) {
      newValue = newValue.replace(/[\r\n]/g, '');
    }
    internalValueRef.current = newValue;
    setValue(newValue);
    onSaveRef.current(newValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => {
    if (singleLine && e.key === 'Enter') {
      e.preventDefault();
      inputRef.current?.blur();
    }
  };

  const handleFocus = () => {
    isFocusedRef.current = true;
  };

  const handleBlur = () => {
    isFocusedRef.current = false;
  };

  const commonStyles: React.CSSProperties = {
    fontFamily: 'var(--font-mono)',
    fontSize: '13px',
    lineHeight: '1.3',
    boxSizing: 'border-box',
  };

  return (
    <Box
      className="nodrag"
      onDoubleClick={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        minWidth: `${measuredWidth}px`,
        boxSizing: 'border-box',
      }}
    >
      {/* Hidden span for width measurement */}
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

      {singleLine ? (
        <TextField.Root
          ref={inputRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onFocus={handleFocus}
          onBlur={handleBlur}
          color="iris"
          variant="soft"
          size="1"
          style={{
            ...commonStyles,
            width: '100%',
            height: '24px',
          }}
        />
      ) : (
        <TextArea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          color="iris"
          variant="soft"
          size="1"
          wrap="off"
          style={{
            ...commonStyles,
            width: '100%',
            minHeight: `${minHeight}px`,
            height: 'auto',
            resize: 'none',
            overflow: 'hidden',
            whiteSpace: 'pre',
          }}
        />
      )}
    </Box>
  );
};
