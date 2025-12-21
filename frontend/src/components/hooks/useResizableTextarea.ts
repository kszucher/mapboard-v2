import { useCallback, useEffect, useRef, useState } from 'react';

interface UseResizableTextareaProps {
  initialValue: string;
  savedHeight: number;
  savedWidth: number;
  onSave: (value: string, height: number, width: number) => void;
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
  savedWidth,
  onSave,
}: UseResizableTextareaProps): UseResizableTextareaReturn => {
  const [localValue, setLocalValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialHeightRef = useRef(savedHeight);
  const initialWidthRef = useRef(savedWidth);
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
      const currentWidth = textareaRef.current?.offsetWidth ?? savedWidth;
      lastSavedValueRef.current = localValue;
      onSaveRef.current(localValue, currentHeight, currentWidth);
    }, 300);

    return () => clearTimeout(timeout);
  }, [localValue, initialValue, savedHeight, savedWidth]);

  const handleMouseDown = useCallback(() => {
    // Track initial dimensions when mouse down
    initialHeightRef.current = textareaRef.current?.offsetHeight ?? savedHeight;
    initialWidthRef.current = textareaRef.current?.offsetWidth ?? savedWidth;
  }, [savedHeight, savedWidth]);

  const handleMouseUp = useCallback(() => {
    // Only save if dimensions actually changed (user was resizing)
    const currentHeight = textareaRef.current?.offsetHeight;
    const currentWidth = textareaRef.current?.offsetWidth;

    if (currentHeight && currentWidth &&
      (currentHeight !== initialHeightRef.current || currentWidth !== initialWidthRef.current) &&
      currentHeight >= 60) {
      onSaveRef.current(localValue, currentHeight, currentWidth);
    }
  }, [localValue]);

  const handleBlur = useCallback(() => {
    if (localValue !== initialValue) {
      const currentHeight = textareaRef.current?.offsetHeight ?? savedHeight;
      const currentWidth = textareaRef.current?.offsetWidth ?? savedWidth;
      onSaveRef.current(localValue, currentHeight, currentWidth);
    }
  }, [localValue, initialValue, savedHeight, savedWidth]);

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
