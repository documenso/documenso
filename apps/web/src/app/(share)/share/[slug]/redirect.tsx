'use client';

import { useEffect } from 'react';

import { env } from '~/env.mjs';

export const Redirect = () => {
  useEffect(() => {
    window.location.href = env.NEXT_PUBLIC_MARKETING_URL;
  }, []);

  return null;
};
