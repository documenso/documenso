import { useEffect, useMemo, useState } from 'react';

import type { Field } from '@prisma/client';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';

export const useFieldPageCoords = (field: Field) => {
  const [forceRecalc, setForceRecalc] = useState(0);

  const coords = useMemo(() => {
    const $page = document.querySelector<HTMLElement>(
      `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`,
    );

    if (!$page) {
      return {
        x: 0,
        y: 0,
        height: 0,
        width: 0,
      };
    }

    const { top, left, height, width } = getBoundingClientRect($page);

    // X and Y are percentages of the page's height and width
    const fieldX = (Number(field.positionX) / 100) * width + left;
    const fieldY = (Number(field.positionY) / 100) * height + top;

    const fieldHeight = (Number(field.height) / 100) * height;
    const fieldWidth = (Number(field.width) / 100) * width;

    return {
      x: fieldX,
      y: fieldY,
      height: fieldHeight,
      width: fieldWidth,
    };
  }, [field.height, field.page, field.positionX, field.positionY, field.width, forceRecalc]);

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
    const $page = document.querySelector<HTMLElement>(
      `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`,
    );

    if (!$page) {
      return;
    }

    const observer = new ResizeObserver(() => {
      setForceRecalc((prev) => prev + 1);
    });

    observer.observe($page);

    return () => {
      observer.disconnect();
    };
  }, [field.page]);

  return coords;
};
