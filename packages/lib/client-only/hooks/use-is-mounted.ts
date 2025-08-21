import { useSyncExternalStore } from 'react';

const subscribe = () => {
  return () => {};
};

const getSnapshot = () => {
  return true;
};

const getServerSnapshot = () => {
  return false;
};

export const useIsMounted = () => {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
};
