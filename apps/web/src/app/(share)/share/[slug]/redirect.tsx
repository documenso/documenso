'use client';

import { useEffect } from 'react';

export const Redirect = () => {
  useEffect(() => {
    window.location.href = process.env.NEXT_PUBLIC_MARKETING_URL ?? 'http://localhost:3001';
  }, []);

  return null;
};
