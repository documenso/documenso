import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import type { Field } from '@prisma/client';
import { useCallback, useLayoutEffect, useState } from 'react';

export type FieldPageCoords = {
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * The pixel box of a field within its rendered PDF page, kept up to date as the page
 * resizes. Null until the page is in the DOM.
 */
export const useFieldPageCoords = (
  field: Pick<Field, 'positionX' | 'positionY' | 'width' | 'height' | 'page'>,
): FieldPageCoords | null => {
  const [coords, setCoords] = useState<FieldPageCoords | null>(null);

  const calculateCoords = useCallback(() => {
    const $page = document.querySelector<HTMLElement>(`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`);

    if (!$page) {
      setCoords(null);
      return;
    }

    const { height, width } = getBoundingClientRect($page);

    setCoords({
      x: (Number(field.positionX) / 100) * width,
      y: (Number(field.positionY) / 100) * height,
      width: (Number(field.width) / 100) * width,
      height: (Number(field.height) / 100) * height,
    });
  }, [field.page, field.positionX, field.positionY, field.width, field.height]);

  // Measured before paint so nothing renders at a stale position for a frame.
  useLayoutEffect(() => {
    calculateCoords();

    window.addEventListener('resize', calculateCoords);

    const $page = document.querySelector<HTMLElement>(`${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`);

    const observer = new ResizeObserver(calculateCoords);

    if ($page) {
      observer.observe($page);
    }

    return () => {
      window.removeEventListener('resize', calculateCoords);
      observer.disconnect();
    };
  }, [calculateCoords, field.page]);

  return coords;
};
