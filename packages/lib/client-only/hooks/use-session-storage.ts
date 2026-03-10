import * as React from 'react';
import type { Dispatch, SetStateAction } from 'react';

function dispatchStorageEvent(key: string, newValue: string | null) {
  window.dispatchEvent(new StorageEvent('storage', { key, newValue }));
}

const setSessionStorageItem = <T>(key: string, value: T) => {
  const stringifiedValue = JSON.stringify(value);
  window.sessionStorage.setItem(key, stringifiedValue);
  dispatchStorageEvent(key, stringifiedValue);
};

const removeSessionStorageItem = (key: string) => {
  window.sessionStorage.removeItem(key);
  dispatchStorageEvent(key, null);
};

const getSessionStorageItem = (key: string) => {
  return window.sessionStorage.getItem(key);
};

const useSessionStorageSubscribe = (callback: (event: StorageEvent) => void) => {
  window.addEventListener('storage', callback);
  return () => window.removeEventListener('storage', callback);
};

export function useSessionStorage<T>(
  key: string,
  initialValue: T,
): [T, Dispatch<SetStateAction<T>>] {
  const serializedInitialValue = JSON.stringify(initialValue);

  const getSnapshot = () => getSessionStorageItem(key);
  const getServerSnapshot = () => serializedInitialValue;

  const store = React.useSyncExternalStore(
    useSessionStorageSubscribe,
    getSnapshot,
    getServerSnapshot,
  );

  const setState: Dispatch<SetStateAction<T>> = React.useCallback(
    (v) => {
      try {
        const prevValue = store ? JSON.parse(store) : initialValue;
        // @ts-expect-error - SetStateAction function check is safe at runtime
        const nextState = typeof v === 'function' ? v(prevValue) : v;

        if (nextState === undefined || nextState === null) {
          removeSessionStorageItem(key);
        } else {
          setSessionStorageItem(key, nextState);
        }
      } catch (e) {
        console.warn(e);
      }
    },
    [key, store, initialValue],
  );

  React.useEffect(() => {
    if (getSessionStorageItem(key) === null && typeof initialValue !== 'undefined') {
      setSessionStorageItem(key, initialValue);
    }
  }, [key, initialValue]);

  return [store ? JSON.parse(store) : initialValue, setState];
}
