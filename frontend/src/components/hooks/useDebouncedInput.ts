import { useCallback, useEffect, useRef, useState } from 'react';
import { useDebouncedCallback } from 'use-debounce';

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

  const debouncedOnChange = useDebouncedCallback((newValue: string) => {
    onChangeRef.current(newValue);
  }, debounceMs);

  const handleBlur = useCallback(() => {
    if (draftValue !== null && draftValue !== value) {
      debouncedOnChange.cancel();
      onChangeRef.current(draftValue);
    }
  }, [debouncedOnChange, draftValue, value]);

  const setLocalValue = useCallback((newValue: string) => {
    setDraftValue(newValue);
    if (newValue !== value) {
      debouncedOnChange(newValue);
    }
  }, [debouncedOnChange, value]);

  return {
    localValue,
    setLocalValue,
    handleBlur,
  };
};
