import { useCallback, useEffect } from 'react';

import { useRevalidator } from 'react-router';

/**
 * Not really used anymore, this causes random 500s when the user refreshes while this occurs.
 */
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
