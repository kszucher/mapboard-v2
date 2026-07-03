import { useEffect, useRef, useState } from 'react';

interface PlainEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  disabled?: boolean;
}

export const FlowNodeExpressionEditor = ({
  initialValue,
  onSave,
  disabled = false,
}: PlainEditorProps) => {
  const elementRef = useRef<HTMLSpanElement>(null);
  const [isFocused, setIsFocused] = useState(false);

  // Sync internal text with initialValue, but only when not currently typing/focused
  useEffect(() => {
    if (elementRef.current && document.activeElement !== elementRef.current) {
      elementRef.current.innerText = initialValue;
    }
  }, [initialValue]);

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleInput = (e: React.FormEvent<HTMLSpanElement>) => {
    const newValue = e.currentTarget.innerText.replace(/[\r\n]/g, '');

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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLSpanElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      elementRef.current?.blur();
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
  };

  const handleBlur = () => {
    setIsFocused(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (elementRef.current) {
      const finalValue = elementRef.current.innerText.replace(/[\r\n]/g, '');
      onSaveRef.current(finalValue);
    }
  };

  return (
    <div
      className="nodrag nopan"
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
      }}
    >
      <div
        // 1. Trigger focus on the span when clicking the wrapper div
        onClick={() => {
          if (!disabled) {
            elementRef.current?.focus();
          }
        }}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          background: 'var(--gray-a3)',
          borderRadius: 'var(--radius-1)',
          padding: '2px 8px',
          boxSizing: 'border-box',
          minHeight: '24px',
          flexGrow: 1,
          minWidth: '120px',
          outline: isFocused ? '1px solid var(--accent-8)' : 'none',
          boxShadow: isFocused ? '0 0 0 1px var(--accent-8)' : 'none',
          // 2. Move the cursor behavior here
          cursor: disabled ? 'default' : 'text',
        }}
      >
      <span
        ref={elementRef}
        contentEditable={!disabled}
        suppressContentEditableWarning
        onInput={handleInput}
        onKeyDown={handleKeyDown}
        onFocus={handleFocus}
        onBlur={handleBlur}
        style={{
          fontFamily: 'Consolas, Menlo, Monaco, "Courier New", monospace',
          fontSize: '13px',
          outline: 'none',
          minWidth: '50px',
          whiteSpace: 'pre',
          // 3. Keep width 100% so the text hit-box fills the space
          width: '100%',
          userSelect: disabled ? 'none' : 'text',
          opacity: disabled ? 0.7 : 1,
          color: 'var(--gray-12)',
        }}
      />
      </div>
    </div>
  );
};
