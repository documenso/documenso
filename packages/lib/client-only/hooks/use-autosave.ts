import { useCallback, useEffect, useRef } from 'react';

type SaveRequest<T, R> = {
  data: T;
  onResponse?: (response: R) => void;
};

export const useAutoSave = <T, R = void>(
  onSave: (data: T) => Promise<R>,
  options: { delay?: number } = {},
) => {
  const { delay = 2000 } = options;

  const saveTimeoutRef = useRef<NodeJS.Timeout>();
  const saveQueueRef = useRef<SaveRequest<T, R>[]>([]);
  const isProcessingRef = useRef(false);

  const processQueue = async () => {
    if (isProcessingRef.current || saveQueueRef.current.length === 0) {
      return;
    }

    isProcessingRef.current = true;

    while (saveQueueRef.current.length > 0) {
      const request = saveQueueRef.current.shift()!;

      try {
        const response = await onSave(request.data);
        request.onResponse?.(response);
      } catch (error) {
        console.error('Auto-save failed:', error);
      }
    }

    isProcessingRef.current = false;
  };

  const saveFormData = async (data: T, onResponse?: (response: R) => void) => {
    saveQueueRef.current.push({ data, onResponse });
    await processQueue();
  };

  const scheduleSave = useCallback(
    (data: T, onResponse?: (response: R) => void) => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }

      saveTimeoutRef.current = setTimeout(() => void saveFormData(data, onResponse), delay);
    },
    [delay],
  );

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return { scheduleSave };
};
