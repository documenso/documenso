'use client';

import { useEffect } from 'react';

export default function Redirect() {
  useEffect(() => {
    const timer = setTimeout(() => {
      window.location.href = 'https://www.documenso.com';
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  return <div></div>;
}
