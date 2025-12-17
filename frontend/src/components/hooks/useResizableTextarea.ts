import React, { useEffect, useRef, useState } from 'react';

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

  // Sync local value with prop changes
  useEffect(() => {
    setLocalValue(initialValue);
  }, [initialValue]);

  // Debounced auto-save while typing
  useEffect(() => {
    if (localValue === initialValue) return;

    const timeout = setTimeout(() => {
      const currentHeight = textareaRef.current?.offsetHeight ?? savedHeight;
      onSave(localValue, currentHeight);
    }, 300);

    return () => clearTimeout(timeout);
  }, [localValue, initialValue, onSave, savedHeight]);

  const handleMouseDown = () => {
    // Track initial height when mouse down
    initialHeightRef.current = textareaRef.current?.offsetHeight ?? savedHeight;
  };

  const handleMouseUp = () => {
    // Only save if height actually changed (user was resizing)
    const currentHeight = textareaRef.current?.offsetHeight;
    if (currentHeight && currentHeight !== initialHeightRef.current && currentHeight >= 60) {
      onSave(localValue, currentHeight);
    }
  };

  const handleBlur = () => {
    if (localValue !== initialValue) {
      const currentHeight = textareaRef.current?.offsetHeight ?? savedHeight;
      onSave(localValue, currentHeight);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
    // Shift+Enter allows new line (default behavior)
  };

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
