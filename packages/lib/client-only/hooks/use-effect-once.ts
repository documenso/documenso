/* eslint-disable react-hooks/rules-of-hooks */
import type { EffectCallback } from 'react';
import { useEffect, useRef } from 'react';

/**
 * Dangerously runs an effect "once" by ignoring the depedencies of a given effect.
 *
 * DANGER: The effect will run twice in concurrent react and development environments.
 */
export const unsafe_useEffectOnce = (callback: EffectCallback) => {
  // Intentionally avoiding exhaustive deps and rule of hooks here
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/rules-of-hooks
  return useEffect(callback, []);
};

export const veryUnsafe_useEffectOnce = (callback: EffectCallback) => {
  const ref = useRef(false);

  return useEffect(() => {
    if (!ref.current) {
      void callback();
    }

    ref.current = true;
  }, []);
};
