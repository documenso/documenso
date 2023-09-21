'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

export default function Redirect() {
  const { push } = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      push('/');
    }, 3000);

    return () => clearTimeout(timer);
  }, [push]);

  return <div></div>;
}
