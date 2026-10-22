import { useRef } from 'react';

/**
 * A ref which always holds the latest value.
 *
 * Useful for long lived callbacks (e.g. Konva event handlers bound once when
 * a stage is created) which need to read current state without stale closures.
 */
export const useLatestRef = <T>(value: T) => {
  const ref = useRef(value);

  ref.current = value;

  return ref;
};
