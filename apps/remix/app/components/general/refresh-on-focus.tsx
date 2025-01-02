import { useCallback, useEffect } from 'react';

import { useRevalidator } from 'react-router';

export const RefreshOnFocus = () => {
  const { revalidate } = useRevalidator();

  const onFocus = useCallback(() => {
    void revalidate();
  }, [revalidate]);

  useEffect(() => {
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [onFocus]);

  return null;
};
