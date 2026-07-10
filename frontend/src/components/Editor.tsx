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
  const elementRef = useRef<HTMLSpanElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isSelected, setIsSelected] = useState(false);

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

  // Focus and place caret at the end when editing starts
  useEffect(() => {
    if (isEditing && elementRef.current) {
      elementRef.current.focus();
      const range = document.createRange();
      range.selectNodeContents(elementRef.current);
      range.collapse(false);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
  }, [isEditing]);

  const handleBlur = () => {
    setIsEditing(false);
    setIsSelected(false);
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (elementRef.current) {
      const finalValue = elementRef.current.innerText.replace(/[\r\n]/g, '');
      onSaveRef.current(finalValue);
    }
    // Clear selection on blur
    window.getSelection()?.removeAllRanges();
  };

  // Clear selection / state when clicking outside the editor
  useEffect(() => {
    if (!isSelected) return;
    const handleDocumentClick = (e: MouseEvent) => {
      if (elementRef.current && !elementRef.current.contains(e.target as Node)) {
        setIsSelected(false);
        setIsEditing(false);
        window.getSelection()?.removeAllRanges();
      }
    };
    // Use capture phase so we get the click event even if someone else stopPropagation's it
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
      // Second click: enter edit mode
      e.stopPropagation();
      setIsEditing(true);
    }
  };

  return (
    <div
      className={isSelected ? "nodrag nopan" : undefined}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        if (isSelected) {
          e.stopPropagation();
        }
      }}
      onPointerDown={(e) => {
        if (isSelected) {
          e.stopPropagation();
        }
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
          cursor: disabled ? 'default' : (isSelected ? 'text' : 'pointer'),
        }}
      >
        <span
          ref={elementRef}
          contentEditable={!disabled && isEditing}
          suppressContentEditableWarning
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          style={{
            fontFamily: 'Consolas, Menlo, Monaco, "Courier New", monospace',
            fontSize: '13px',
            outline: 'none',
            minWidth: '50px',
            whiteSpace: 'pre',
            width: '100%',
            userSelect: isEditing ? 'text' : 'none',
            opacity: disabled ? 0.7 : 1,
            color: 'var(--gray-12)',
          }}
        />
      </div>
    </div>
  );
};
