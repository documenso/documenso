import type { EffectCallback } from 'react';
import { useEffect } from 'react';

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
