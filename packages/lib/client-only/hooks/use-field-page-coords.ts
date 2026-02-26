import { useCallback, useEffect, useState } from 'react';

import type { Field } from '@prisma/client';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';
import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';

export const useFieldPageCoords = (
  field: Pick<Field, 'positionX' | 'positionY' | 'width' | 'height' | 'page'>,
) => {
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

  // Watch for the page element to appear in the DOM (e.g. after a virtual list
  // scroll) and recalculate coords. Also attach a ResizeObserver once the page
  // element exists.
  useEffect(() => {
    const pageSelector = `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`;

    let resizeObserver: ResizeObserver | null = null;
    let observedElement: HTMLElement | null = null;

    const attachResizeObserver = ($page: HTMLElement) => {
      if ($page === observedElement) {
        return;
      }

      resizeObserver?.disconnect();
      resizeObserver = new ResizeObserver(() => {
        calculateCoords();
      });
      resizeObserver.observe($page);
      observedElement = $page;
    };

    // Try to attach immediately if the page already exists.
    const existingPage = document.querySelector<HTMLElement>(pageSelector);

    if (existingPage) {
      attachResizeObserver(existingPage);
    }

    // Watch for DOM mutations to detect when the page element appears (e.g.
    // after the virtual list scrolls to a new page and renders it).
    const mutationObserver = new MutationObserver(() => {
      const $page = document.querySelector<HTMLElement>(pageSelector);

      if (!$page) {
        return;
      }

      // Only recalculate when the observed page element has changed (e.g. new
      // element appeared after virtual list scroll). Skip when mutations are
      // from elsewhere in the DOM and the page element is unchanged.
      if ($page === observedElement) {
        return;
      }

      calculateCoords();
      attachResizeObserver($page);
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      mutationObserver.disconnect();
      resizeObserver?.disconnect();
      observedElement = null;
    };
  }, [calculateCoords, field.page]);

  return coords;
};
