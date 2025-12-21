import { useCallback, useEffect, useRef, useState } from 'react';

interface UseAutoSizingTextareaProps {
  initialValue: string;
  onSave: (value: string) => void;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
}

interface UseAutoSizingTextareaReturn {
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
  localValue: string;
  setLocalValue: (value: string) => void;
  handleBlur: () => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  width: number;
  height: number;
}

export const useResizableTextarea = ({
  initialValue,
  onSave,
  minWidth = 240,
  minHeight = 60,
  maxWidth = 600,
}: UseAutoSizingTextareaProps): UseAutoSizingTextareaReturn => {
  const [localValue, setLocalValue] = useState(initialValue);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSavedValueRef = useRef(initialValue);
  const onSaveRef = useRef(onSave);

  const [dimensions, setDimensions] = useState({ width: minWidth, height: minHeight });

  // Keep onSave ref up to date
  useEffect(() => {
    onSaveRef.current = onSave;
  }, [onSave]);

  // Sync local value when prop changes externally
  useEffect(() => {
    if (initialValue !== lastSavedValueRef.current) {
      setLocalValue(initialValue);
      lastSavedValueRef.current = initialValue;
    }
  }, [initialValue]);

  // Measure text to determine dimensions
  useEffect(() => {
    if (!textareaRef.current) return;

    const measureElement = document.createElement('div');
    const styles = window.getComputedStyle(textareaRef.current);

    measureElement.style.visibility = 'hidden';
    measureElement.style.position = 'absolute';
    measureElement.style.whiteSpace = 'pre'; // Start with single line measurement
    measureElement.style.font = styles.font;
    measureElement.style.padding = styles.padding;
    measureElement.style.border = styles.border;
    measureElement.style.boxSizing = 'border-box';

    // Add a specialized character if ending in newline to force the extra line to render
    const displayValue = localValue || ' ';
    measureElement.textContent = displayValue + (displayValue.endsWith('\n') ? '\u200b' : '');

    document.body.appendChild(measureElement);

    // 1. Measure desired width
    let newWidth = measureElement.offsetWidth + 20; // Add some buffer
    let newHeight = minHeight;

    if (newWidth > maxWidth) {
      newWidth = maxWidth;
      // If width constrained, allow wrapping for height calculation
      measureElement.style.whiteSpace = 'pre-wrap';
      measureElement.style.width = `${maxWidth}px`;
      newHeight = measureElement.offsetHeight;
    } else {
      // Even if width is okay, check for explicit newlines causing height growth
      if (localValue.includes('\n')) {
        measureElement.style.whiteSpace = 'pre-wrap';
        newHeight = measureElement.offsetHeight;
      }
    }

    document.body.removeChild(measureElement);

    setDimensions({
      width: Math.max(minWidth, newWidth),
      height: Math.max(minHeight, newHeight + 10) // buffer
    });

  }, [localValue, minWidth, minHeight, maxWidth]);

  // Debounced auto-save
  useEffect(() => {
    if (localValue === initialValue) return;

    const timeout = setTimeout(() => {
      lastSavedValueRef.current = localValue;
      onSaveRef.current(localValue);
    }, 500);

    return () => clearTimeout(timeout);
  }, [localValue, initialValue]);

  const handleBlur = useCallback(() => {
    if (localValue !== initialValue) {
      onSaveRef.current(localValue);
    }
  }, [localValue, initialValue]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      e.currentTarget.blur();
    }
  }, []);

  return {
    textareaRef,
    localValue,
    setLocalValue,
    handleBlur,
    handleKeyDown,
    width: dimensions.width,
    height: dimensions.height,
  };
};
