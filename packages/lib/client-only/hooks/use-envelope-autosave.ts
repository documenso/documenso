import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debounced autosave for the envelope editor (recipients, fields, settings).
 *
 * Only one save runs at a time and the latest edit always wins. If the user
 * keeps editing while a save is on the wire, their newest changes get saved
 * right after, never dropped.
 */
export function useEnvelopeAutosave<T>(saveFn: (data: T) => Promise<void>, delay = 1000) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The edit waiting to be saved. Wrapped in an object so null always means "nothing queued".
  const pendingRef = useRef<{ value: T } | null>(null);

  // The save currently running, if any. Shared so we never kick off two at once.
  const commitPromiseRef = useRef<Promise<void> | null>(null);

  // saveFn closes over editor state, so keep the latest one around without
  // making triggerSave/flush depend on it.
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const [isPending, setIsPending] = useState(false);
  const [isCommiting, setIsCommiting] = useState(false);

  /**
   * Runs saves one at a time until the queue is empty. Anything queued
   * mid-save gets picked up on the next loop.
   */
  const commit = useCallback((): Promise<void> => {
    if (commitPromiseRef.current) {
      return commitPromiseRef.current;
    }

    if (!pendingRef.current) {
      return Promise.resolve();
    }

    const pump = (async () => {
      try {
        setIsCommiting(true);

        while (pendingRef.current) {
          const { value } = pendingRef.current;
          pendingRef.current = null;

          await saveFnRef.current(value);
        }
      } finally {
        // eslint-disable-next-line require-atomic-updates
        commitPromiseRef.current = null;
        setIsCommiting(false);
        setIsPending(false);
      }
    })();

    commitPromiseRef.current = pump;

    return pump;
  }, []);

  const triggerSave = useCallback(
    (data: T) => {
      pendingRef.current = { value: data };

      setIsPending(true);

      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        void commit();
      }, delay);
    },
    [commit, delay],
  );

  /**
   * Skip the debounce and save now. The editor calls this when it needs
   * everything persisted, e.g. before sending or switching steps.
   */
  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    await commit();
  }, [commit]);

  // Last-ditch attempt to save if the tab closes with unsaved edits.
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (timeoutRef.current || pendingRef.current || commitPromiseRef.current) {
        void flush();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flush]);

  return { triggerSave, flush, isPending, isCommiting };
}
