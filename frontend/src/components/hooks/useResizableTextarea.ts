import { useCallback, useEffect, useRef, useState } from 'react';

interface UseResizableTextareaProps {
  initialValue: string;
  savedHeight: number;
  onSave: (value: string, height: number) => void;
}

interface UseResizableTextareaReturn {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  localValue: string;
  setLocalValue: (value: string) => void;
  handleMouseDown: () => void;
  handleMouseUp: () => void;
  handleBlur: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
}

export const useResizableTextarea = ({
  initialValue,
  savedHeight,
  onSave,
}: UseResizableTextareaProps): UseResizableTextareaReturn => {
  const [localValue, setLocalValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialHeightRef = useRef(savedHeight);
  const lastSavedValueRef = useRef(initialValue);
  const onSaveRef = useRef(onSave);

  // Keep onSave ref up to date without causing re-renders
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Sync local value when prop changes externally (not from our own save)
  useEffect(() => {
    // Only sync if the prop changed and it's different from what we last saved
    // This prevents syncing when the prop update came from our own onSave callback
    if (initialValue !== lastSavedValueRef.current) {
      setLocalValue(initialValue);
      lastSavedValueRef.current = initialValue;
    }
  }, [initialValue]);

  // Debounced auto-save while typing
  useEffect(() => {
    if (localValue === initialValue) return;

    const timeout = setTimeout(() => {
      const currentHeight = textareaRef.current?.offsetHeight ?? savedHeight;
      lastSavedValueRef.current = localValue;
      onSaveRef.current(localValue, currentHeight);
    }, 300);

    return () => clearTimeout(timeout);
  }, [localValue, initialValue, savedHeight]);

  const handleMouseDown = useCallback(() => {
    // Track initial height when mouse down
    initialHeightRef.current = textareaRef.current?.offsetHeight ?? savedHeight;
  }, [savedHeight]);

  const handleMouseUp = useCallback(() => {
    // Only save if height actually changed (user was resizing)
    const currentHeight = textareaRef.current?.offsetHeight;
    if (currentHeight && currentHeight !== initialHeightRef.current && currentHeight >= 60) {
      onSaveRef.current(localValue, currentHeight);
    }
  }, [localValue]);

  const handleBlur = useCallback(() => {
    if (localValue !== initialValue) {
      const currentHeight = textareaRef.current?.offsetHeight ?? savedHeight;
      onSaveRef.current(localValue, currentHeight);
    }
  }, [localValue, initialValue, savedHeight]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
    // Shift+Enter allows new line (default behavior)
  }, []);

  return {
    textareaRef,
    localValue,
    setLocalValue,
    handleMouseDown,
    handleMouseUp,
    handleBlur,
    handleKeyDown,
  };
};
