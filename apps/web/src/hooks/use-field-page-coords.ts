import { useCallback, useEffect, useState } from 'react';

import { Field } from '@documenso/prisma/client';

import { PDF_VIEWER_PAGE_SELECTOR } from '~/components/(dashboard)/pdf-viewer/types';
import { getBoundingClientRect } from '~/helpers/getBoundingClientRect';

export const useFieldPageCoords = (field: Field) => {
  const [coords, setCoords] = useState({
    x: 0,
    y: 0,
    height: 0,
    width: 0,
  });

  const calculateCoords = useCallback(() => {
    const $page = document.querySelector<HTMLElement>(
      `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`,
    );

    if (!$page) {
      return;
    }

    const { top, left, height, width } = getBoundingClientRect($page);

    // X and Y are percentages of the page's height and width
    const fieldX = (Number(field.positionX) / 100) * width + left;
    const fieldY = (Number(field.positionY) / 100) * height + top;

    const fieldHeight = (Number(field.height) / 100) * height;
    const fieldWidth = (Number(field.width) / 100) * width;

    setCoords({
      x: fieldX,
      y: fieldY,
      height: fieldHeight,
      width: fieldWidth,
    });
  }, [field.height, field.page, field.positionX, field.positionY, field.width]);

  useEffect(() => {
    calculateCoords();
  }, [calculateCoords]);

  useEffect(() => {
    const onResize = () => {
      calculateCoords();
    };

    window.addEventListener('resize', onResize);

    return () => {
      window.removeEventListener('resize', onResize);
    };
  }, [calculateCoords]);

  useEffect(() => {
    const $page = document.querySelector<HTMLElement>(
      `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`,
    );

    if (!$page) {
      return;
    }

    const observer = new ResizeObserver(() => {
      calculateCoords();
    });

    observer.observe($page);

    return () => {
      observer.disconnect();
    };
  }, [calculateCoords, field.page]);

  return coords;
};
