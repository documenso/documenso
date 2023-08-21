import { useEffect, useState } from 'react';

export function useWindowSize() {
  const [size, setSize] = useState({
    width: 0,
    height: 0,
  });

  const onResize = () => {
    setSize({
      width: window.innerWidth,
      height: window.innerHeight,
    });
  };

  useEffect(() => {
    onResize();

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return size;
}
