import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Returns the value, or the last non-null value for a short while after it becomes null,
 * along with a function to drop the lingering value early.
 *
 * Useful for UI which should linger briefly after whatever triggered it goes away, such
 * as a popover the pointer needs a moment to travel to.
 */
export const useHeldValue = <T>(value: T | null, holdMs: number): [T | null, () => void] => {
  const [lingeringValue, setLingeringValue] = useState<T | null>(null);
  const timeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearHoldTimeout = () => {
    if (timeout.current) {
      clearTimeout(timeout.current);
      timeout.current = null;
    }
  };

  useEffect(() => {
    clearHoldTimeout();

    if (value !== null) {
      setLingeringValue(value);
      return;
    }

    timeout.current = setTimeout(() => {
      setLingeringValue(null);
    }, holdMs);

    return clearHoldTimeout;
  }, [value, holdMs]);

  const dropHeldValue = useCallback(() => {
    clearHoldTimeout();
    setLingeringValue(null);
  }, []);

  return [value ?? lingeringValue, dropHeldValue];
};
