import { useEffect, useState } from 'react';

// Resolves after mount so SSR and first client render agree.
export const useIsFramed = () => {
  const [isFramed, setIsFramed] = useState(false);

  useEffect(() => {
    setIsFramed(window.self !== window.top);
  }, []);

  return isFramed;
};
