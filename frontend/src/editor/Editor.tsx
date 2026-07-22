import { useCallback, useEffect, useRef, useState } from 'react';

interface PlainEditorProps {
  initialValue: string;
  onSave: (value: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  onSelect: () => void;
}

export const Editor = ({
  initialValue,
  onSave,
  disabled = false,
  readOnly = false,
  onSelect,
}: PlainEditorProps) => {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(initialValue);
  const [committedDraft, setCommittedDraft] = useState<string | null>(null);
  const [prevInitialValue, setPrevInitialValue] = useState(initialValue);

  if (initialValue !== prevInitialValue) {
    setPrevInitialValue(initialValue);
    setCommittedDraft(null);
  }

  const startEditing = useCallback(() => {
    if (disabled || readOnly) return;
    setDraft(committedDraft ?? initialValue);
    setIsEditing(true);
  }, [disabled, readOnly, committedDraft, initialValue]);

  const commitEditing = () => {
    if (draft !== initialValue) {
      setCommittedDraft(draft);
      onSave(draft);
    }
    setIsEditing(false);
  };

  // Focus and select-to-end when editing starts
  useEffect(() => {
    if (isEditing && inputRef.current) {
      const el = inputRef.current;
      el.focus();
      const end = el.value.length;
      el.setSelectionRange(end, end);
    }
  }, [isEditing]);

  const handleWrapperClick = (e: React.MouseEvent) => {
    if (disabled) return;

    e.stopPropagation();
    onSelect();
    if (!isEditing && !readOnly) {
      startEditing();
    }
  };

  const textStyle: React.CSSProperties = {
    fontFamily: 'Consolas, Menlo, Monaco, "Courier New", monospace',
    fontSize: '13px',
    lineHeight: '18px',
    minWidth: '50px',
    width: '100%',
    color: readOnly ? 'var(--gray-10)' : 'var(--gray-12)',
    boxSizing: 'border-box',
    margin: 0,
  };

  return (
    <div
      ref={wrapperRef}
      className={isEditing ? 'nodrag nopan slot-editor-wrapper' : 'slot-editor-wrapper'}
      onDoubleClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => {
        if (isEditing) e.stopPropagation();
      }}
      onPointerDown={(e) => {
        if (isEditing) e.stopPropagation();
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
          outline: isEditing ? '1px solid var(--accent-8)' : 'none',
          boxShadow: isEditing ? '0 0 0 1px var(--accent-8)' : 'none',
          cursor: disabled ? 'default' : isEditing ? 'text' : 'pointer',
        }}
      >
        {isEditing ? (
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onBlur={commitEditing}
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
            {committedDraft ?? initialValue}
          </span>
        )}
      </div>
    </div>
  );
};
