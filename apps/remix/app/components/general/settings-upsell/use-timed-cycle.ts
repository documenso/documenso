import { useReducedMotion } from 'framer-motion';
import { useEffect, useState } from 'react';

/**
 * Cycles an index through `durations.length` steps, waiting `durations[i]`
 * milliseconds on step `i` before advancing to the next.
 *
 * When the cycle wraps past the last step it continues from `loopStartIndex`
 * (default `0`), letting consumers play intro-only steps exactly once and
 * then loop through the remaining steps forever.
 *
 * Under `prefers-reduced-motion` the cycle never starts and the index stays
 * at 0, so consumers render their initial state statically.
 *
 * Pass module-level constants for `durations` and `loopStartIndex` — their
 * identities are intentionally not dependencies.
 */
export const useTimedCycle = (durations: number[], loopStartIndex = 0) => {
  const [index, setIndex] = useState(0);

  const isReducedMotion = useReducedMotion();

  useEffect(() => {
    if (isReducedMotion || durations.length === 0) {
      setIndex(0);
      return;
    }

    let current = 0;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      const next = current + 1;

      current = next >= durations.length ? Math.min(loopStartIndex, durations.length - 1) : next;

      setIndex(current);
      timeout = setTimeout(tick, durations[current]);
    };

    timeout = setTimeout(tick, durations[0]);

    return () => clearTimeout(timeout);
  }, [isReducedMotion]);

  return index;
};
