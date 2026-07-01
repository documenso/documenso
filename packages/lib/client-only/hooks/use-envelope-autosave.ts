import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Debounced, self-serialising autosave helper.
 *
 * Guarantees:
 * - At most one `saveFn` call is in-flight at any time, so saves can never run
 *   concurrently and land out of order.
 * - The most recently queued payload is always committed. In particular calling
 *   `flush()` while an older save is still in-flight waits for that save AND then
 *   commits any newer payload queued in the meantime.
 *
 * The second guarantee is the important one: previously `flush()` would await an
 * in-flight save and return immediately, silently dropping any newer payload that
 * had been queued (and whose debounce timer it had just cleared). Under network
 * lag this lost the user's latest changes - e.g. a freshly typed recipient would
 * never be persisted and the editor would fall back to the "Recipient 1"
 * placeholder.
 */
export function useEnvelopeAutosave<T>(saveFn: (data: T) => Promise<void>, delay = 1000) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // The most recently queued, not-yet-saved payload. Wrapped in an object so that
  // a queued falsy payload is still distinguishable from "nothing queued".
  const pendingRef = useRef<{ value: T } | null>(null);

  // The in-flight commit pump. Concurrent callers await this same promise rather
  // than starting a second, overlapping save.
  const commitPromiseRef = useRef<Promise<void> | null>(null);

  // Always invoke the latest `saveFn` (which may close over fresh state) without
  // having to rebuild `triggerSave`/`flush` on every render.
  const saveFnRef = useRef(saveFn);
  saveFnRef.current = saveFn;

  const [isPending, setIsPending] = useState(false);
  const [isCommiting, setIsCommiting] = useState(false);

  /**
   * Drains the queued payload, running `saveFn` one save at a time until nothing
   * is left to save. If a newer payload is queued while a save is in-flight it is
   * picked up on the next loop iteration, so the latest changes are never lost.
   */
  const commit = useCallback((): Promise<void> => {
    // A pump is already running → share it instead of starting a second one.
    if (commitPromiseRef.current) {
      return commitPromiseRef.current;
    }

    // Nothing queued and nothing in-flight → no work to do.
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

      // A debounce timer or an in-flight save means something is pending.
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

  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    await commit();
  }, [commit]);

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
