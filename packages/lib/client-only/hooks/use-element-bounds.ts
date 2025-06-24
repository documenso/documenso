import { useEffect, useState } from 'react';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';

export const useElementBounds = (elementOrSelector: HTMLElement | string, withScroll = false) => {
  const [bounds, setBounds] = useState({
    top: 0,
    left: 0,
    height: 0,
    width: 0,
  });

  const calculateBounds = () => {
    const $el =
      typeof elementOrSelector === 'string'
        ? document.querySelector<HTMLElement>(elementOrSelector)
        : elementOrSelector;

    if (!$el) {
      throw new Error('Element not found');
    }

    if (withScroll) {
      return getBoundingClientRect($el);
    }

    const { top, left, width, height } = $el.getBoundingClientRect();

    return {
      top,
      left,
      width,
      height,
    };
  };

  useEffect(() => {
    setBounds(calculateBounds());
  }, [calculateBounds]);

  useEffect(() => {
    const onResize = () => {
      setBounds(calculateBounds());
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [calculateBounds]);

  useEffect(() => {
    const $el =
      typeof elementOrSelector === 'string'
        ? document.querySelector<HTMLElement>(elementOrSelector)
        : elementOrSelector;

    if (!$el) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setBounds(calculateBounds());
    });

    observer.observe($el);

    return () => {
      observer.disconnect();
    };
  }, [calculateBounds]);

  return bounds;
};
