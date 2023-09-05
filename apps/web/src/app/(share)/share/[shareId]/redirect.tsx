'use client';

import { useEffect } from 'react';

import { useRouter } from 'next/navigation';

export default function Redirect() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.push('/');
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return <div></div>;
}
