import { useCallback, useEffect, useRef } from 'react';

export const useAutoSave = <T>(onSave: (data: T) => Promise<void>) => {
  const saveTimeoutRef = useRef<NodeJS.Timeout>();

  const saveFormData = async (data: T) => {
    try {
      await onSave(data);
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  };

  const scheduleSave = useCallback((data: T) => {
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => void saveFormData(data), 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  return { scheduleSave };
};
