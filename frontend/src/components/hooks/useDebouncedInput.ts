import { useCallback, useEffect, useRef, useState } from 'react';

interface UseDebouncedInputOptions {
  value: string;
  onChange: (newValue: string) => void;
  debounceMs?: number;
}

/**
 * Custom hook for debounced input fields that syncs with external prop changes.
 * Prevents syncing when the prop update came from our own onChange callback.
 */
export const useDebouncedInput = ({ value, onChange, debounceMs = 300 }: UseDebouncedInputOptions) => {
  const [localValue, setLocalValue] = useState(value);
  const lastSavedValueRef = useRef(value);
  const onChangeRef = useRef(onChange);

  // Keep onChange ref up to date without causing re-renders
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Sync local value when prop changes externally (not from our own save)
  useEffect(() => {
    if (value !== lastSavedValueRef.current) {
      setLocalValue(value);
      lastSavedValueRef.current = value;
    }
  }, [value]);

  // Debounced auto-save while typing
  useEffect(() => {
    if (localValue === value) return;

    const timeout = setTimeout(() => {
      lastSavedValueRef.current = localValue;
      onChangeRef.current(localValue);
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [localValue, value, debounceMs]);

  const handleBlur = useCallback(() => {
    if (localValue !== value) {
      lastSavedValueRef.current = localValue;
      onChangeRef.current(localValue);
    }
  }, [localValue, value]);

  return {
    localValue,
    setLocalValue,
    handleBlur,
  };
};

