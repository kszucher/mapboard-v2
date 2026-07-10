import { useEffect, useRef, useState } from 'react';

interface PlainEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  disabled?: boolean;
}

export const Editor = ({
  initialValue,
  onSave,
  disabled = false,
}: PlainEditorProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);
  const [isSelected, setIsSelected] = useState(false);

  const onSaveRef = useRef(onSave);
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleSave = (newValue: string) => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    debounceTimerRef.current = setTimeout(() => {
      onSaveRef.current(newValue);
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    scheduleSave(newValue);
  };

  const commitAndExit = () => {
    if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
    onSaveRef.current(value);
    setIsEditing(false);
    setIsSelected(false);
  };

  // Focus and select-to-end when editing starts (native input handles caret placement)
  useEffect(() => {
    if (isEditing && inputRef.current) {
      const el = inputRef.current;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, [isEditing]);

  // Clear selection / state when clicking outside the editor
  useEffect(() => {
    if (!isSelected) return;
    const handleDocumentClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setIsSelected(false);
        setIsEditing(false);
      }
    };
    document.addEventListener('click', handleDocumentClick, true);
    return () => document.removeEventListener('click', handleDocumentClick, true);
  }, [isSelected]);

  const handleWrapperClick = (e: React.MouseEvent) => {
    if (disabled) return;

    if (!isSelected) {
      // First click: select the slot item (visualized by border)
      e.stopPropagation();
      setIsSelected(true);
    } else if (!isEditing) {
      // Second click: enter edit mode, seeding the edit buffer from the latest prop value
      e.stopPropagation();
      setValue(initialValue);
      setIsEditing(true);
    }
  };

  const textStyle: React.CSSProperties = {
    fontFamily: 'Consolas, Menlo, Monaco, "Courier New", monospace',
    fontSize: '13px',
    lineHeight: '18px',
    minWidth: '50px',
    width: '100%',
    color: 'var(--gray-12)',
    boxSizing: 'border-box',
    margin: 0,
  };

  return (
    <div
      ref={wrapperRef}
      className={isSelected ? 'nodrag nopan' : undefined}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        if (isSelected) e.stopPropagation();
      }}
      onPointerDown={(e) => {
        if (isSelected) e.stopPropagation();
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        width: '100%',
      }}
    >
      <div
        onClick={handleWrapperClick}
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
          outline: isSelected ? '1px solid var(--accent-8)' : 'none',
          boxShadow: isSelected ? '0 0 0 1px var(--accent-8)' : 'none',
          cursor: disabled ? 'default' : isSelected ? 'text' : 'pointer',
        }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            value={value}
            onChange={handleChange}
            onBlur={commitAndExit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                inputRef.current?.blur();
              }
            }}
            style={
              {
                ...textStyle,
                border: 'none',
                outline: 'none',
                background: 'transparent',
                padding: 0,
                width: 'auto',
                appearance: 'none',
                WebkitAppearance: 'none',
                verticalAlign: 'top',
                // Makes the input grow/shrink with its content, like contentEditable did.
                // Supported in current versions of all major browsers (Baseline as of June 2026);
                // older browsers just fall back to a fixed width instead of breaking.
                fieldSizing: 'content',
              } as React.CSSProperties
            }
          />
        ) : (
          <span
            style={{
              ...textStyle,
              whiteSpace: 'pre',
              userSelect: 'none',
              opacity: disabled ? 0.7 : 1,
              display: 'inline-block',
              verticalAlign: 'top',
            }}
          >
            {initialValue}
          </span>
        )}
      </div>
    </div>
  );
};
