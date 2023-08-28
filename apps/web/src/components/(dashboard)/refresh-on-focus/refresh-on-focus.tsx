'use client';

import { useCallback, useEffect } from 'react';

import { useRouter } from 'next/navigation';

export const RefreshOnFocus = () => {
  // eslint-disable-next-line @typescript-eslint/unbound-method
  const { refresh } = useRouter();

  const onFocus = useCallback(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    window.addEventListener('focus', onFocus);

    return () => {
      window.removeEventListener('focus', onFocus);
    };
  }, [onFocus]);

  return null;
};
