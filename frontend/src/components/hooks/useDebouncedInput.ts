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
  const [draftValue, setDraftValue] = useState<string | null>(null);
  const onChangeRef = useRef(onChange);
  const localValue = draftValue ?? value;

  // Keep onChange ref up to date without causing re-renders
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Debounced auto-save while typing
  useEffect(() => {
    if (draftValue === null) return;
    if (draftValue === value) return;

    const timeout = setTimeout(() => {
      onChangeRef.current(draftValue);
    }, debounceMs);

    return () => clearTimeout(timeout);
  }, [draftValue, value, debounceMs]);

  const handleBlur = useCallback(() => {
    if (draftValue !== null && draftValue !== value) {
      onChangeRef.current(draftValue);
    }
  }, [draftValue, value]);

  const setLocalValue = useCallback((newValue: string) => {
    setDraftValue(newValue);
  }, []);

  return {
    localValue,
    setLocalValue,
    handleBlur,
  };
};

