import { useEffect, useMemo, useState } from 'react';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';

export const useElementBounds = (elementOrSelector: HTMLElement | string, withScroll = false) => {
  const [forceRecalc, setForceRecalc] = useState(0);

  const bounds = useMemo(() => {
    const $el =
      typeof elementOrSelector === 'string'
        ? document.querySelector<HTMLElement>(elementOrSelector)
        : elementOrSelector;

    if (!$el) {
      return {
        top: 0,
        left: 0,
        height: 0,
        width: 0,
      };
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
  }, [elementOrSelector, withScroll, forceRecalc]);

  useEffect(() => {
    const onResize = () => {
      setForceRecalc((prev) => prev + 1);
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, []);

  useEffect(() => {
    const $el =
      typeof elementOrSelector === 'string'
        ? document.querySelector<HTMLElement>(elementOrSelector)
        : elementOrSelector;

    if (!$el) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setForceRecalc((prev) => prev + 1);
    });

    observer.observe($el);

    return () => {
      observer.disconnect();
    };
  }, [elementOrSelector]);

  return bounds;
};
