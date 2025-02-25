import { useCallback, useEffect } from 'react';

import { useRevalidator } from 'react-router';

export const RefreshOnFocus = () => {
  const { revalidate, state } = useRevalidator();

  const onFocus = useCallback(() => {
    if (state === 'idle') {
      void revalidate();
    }
  }, [revalidate]);

  useEffect(() => {
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [onFocus]);

  return null;
};
