import { useCallback, useEffect, useRef, useState } from 'react';

export function useEnvelopeAutosave<T>(saveFn: (data: T) => Promise<void>, delay = 1000) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastArgsRef = useRef<T | null>(null);
  const pendingPromiseRef = useRef<Promise<void> | null>(null);

  const [isPending, setIsPending] = useState(false);
  const [isCommiting, setIsCommiting] = useState(false);

  const triggerSave = useCallback(
    (data: T) => {
      lastArgsRef.current = data;

      // A debounce or promise means something is pending
      setIsPending(true);

      if (timeoutRef.current) clearTimeout(timeoutRef.current);

      // eslint-disable-next-line @typescript-eslint/no-misused-promises
      timeoutRef.current = setTimeout(async () => {
        if (!lastArgsRef.current) {
          return;
        }

        const args = lastArgsRef.current;
        lastArgsRef.current = null;
        timeoutRef.current = null;

        setIsCommiting(true);
        pendingPromiseRef.current = saveFn(args);

        try {
          await pendingPromiseRef.current;
        } finally {
          // eslint-disable-next-line require-atomic-updates
          pendingPromiseRef.current = null;
          setIsCommiting(false);
          setIsPending(false);
        }
      }, delay);
    },
    [saveFn, delay],
  );

  const flush = useCallback(async () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (pendingPromiseRef.current) {
      // Already running → wait for it
      await pendingPromiseRef.current;
      return;
    }

    if (lastArgsRef.current) {
      const args = lastArgsRef.current;
      lastArgsRef.current = null;

      setIsCommiting(true);
      setIsPending(true);

      pendingPromiseRef.current = saveFn(args);
      try {
        await pendingPromiseRef.current;
      } finally {
        // eslint-disable-next-line require-atomic-updates
        pendingPromiseRef.current = null;
        setIsCommiting(false);
        setIsPending(false);
      }
    }
  }, [saveFn]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (timeoutRef.current || pendingPromiseRef.current) {
        void flush();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [flush]);

  return { triggerSave, flush, isPending, isCommiting };
}
