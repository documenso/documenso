import { useSyncExternalStore } from 'react';

const subscribe = () => {
  return () => {};
};

export const useHydrated = () => {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
};
