import { useEffect, useRef, useState } from 'react';

interface PlainEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  isSelected: boolean;
  onSelect: () => void;
  onClearSelect: () => void;
  onIncreaseIndent?: () => void;
  onDecreaseIndent?: () => void;
  onMoveUp?: () => void;
  onMoveDown?: () => void;
  onNavigate?: (direction: 'up' | 'down') => void;
}

export const Editor = ({
  initialValue,
  onSave,
  disabled = false,
  isSelected,
  onSelect,
  onClearSelect,
  onIncreaseIndent,
  onDecreaseIndent,
  onMoveUp,
  onMoveDown,
  onNavigate,
}: PlainEditorProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [value, setValue] = useState(initialValue);
  const [isEditing, setIsEditing] = useState(false);

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
    onClearSelect();
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

  // If isSelected becomes false, exit edit mode
  useEffect(() => {
    if (!isSelected) {
      setIsEditing(false);
    }
  }, [isSelected]);


  // Handle keyboard shortcuts when selected
  useEffect(() => {
    if (!isSelected) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') {
        if (e.ctrlKey && onIncreaseIndent) {
          e.preventDefault();
          e.stopPropagation();
          onIncreaseIndent();
        }
      } else if (e.key === 'ArrowLeft') {
        if (e.ctrlKey && onDecreaseIndent) {
          e.preventDefault();
          e.stopPropagation();
          onDecreaseIndent();
        }
      } else if (e.key === 'ArrowUp') {
        if (e.ctrlKey) {
          if (onMoveUp) {
            e.preventDefault();
            e.stopPropagation();
            onMoveUp();
          }
        } else {
          if (onNavigate) {
            e.preventDefault();
            e.stopPropagation();
            onNavigate('up');
          }
        }
      } else if (e.key === 'ArrowDown') {
        if (e.ctrlKey) {
          if (onMoveDown) {
            e.preventDefault();
            e.stopPropagation();
            onMoveDown();
          }
        } else {
          if (onNavigate) {
            e.preventDefault();
            e.stopPropagation();
            onNavigate('down');
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [isSelected, onIncreaseIndent, onDecreaseIndent, onMoveUp, onMoveDown, onNavigate]);

  const handleWrapperClick = (e: React.MouseEvent) => {
    if (disabled) return;

    if (!isSelected) {
      // First click: select the slot item (visualized by border)
      e.stopPropagation();
      onSelect();
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
      className={isSelected ? 'nodrag nopan slot-editor-wrapper' : 'slot-editor-wrapper'}
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
          cursor: disabled ? 'default' : isEditing ? 'text' : 'pointer',
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
