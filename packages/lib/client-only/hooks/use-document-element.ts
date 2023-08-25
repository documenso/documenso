'use client';

import { useCallback } from 'react';

import { getBoundingClientRect } from '@documenso/lib/client-only/get-bounding-client-rect';

export const useDocumentElement = () => {
  /**
   * Given a mouse event, find the nearest element found by the provided selector.
   */
  const getPage = (event: MouseEvent, pageSelector: string) => {
    if (!(event.target instanceof HTMLElement)) {
      return null;
    }

    const target = event.target;

    const $page =
      target.closest<HTMLElement>(pageSelector) ?? target.querySelector<HTMLElement>(pageSelector);

    if (!$page) {
      return null;
    }

    return $page;
  };

  /**
   * Provided a page and a field, calculate the position of the field
   * as a percentage of the page width and height.
   */
  const getFieldPosition = (page: HTMLElement, field: HTMLElement) => {
    const {
      top: pageTop,
      left: pageLeft,
      height: pageHeight,
      width: pageWidth,
    } = getBoundingClientRect(page);

    const {
      top: fieldTop,
      left: fieldLeft,
      height: fieldHeight,
      width: fieldWidth,
    } = getBoundingClientRect(field);

    return {
      x: ((fieldLeft - pageLeft) / pageWidth) * 100,
      y: ((fieldTop - pageTop) / pageHeight) * 100,
      width: (fieldWidth / pageWidth) * 100,
      height: (fieldHeight / pageHeight) * 100,
    };
  };

  /**
   * Given a mouse event, determine if the mouse is within the bounds of the
   * nearest element found by the provided selector.
   *
   * @param mouseWidth The artifical width of the mouse.
   * @param mouseHeight The artifical height of the mouse.
   */
  const isWithinPageBounds = useCallback(
    (event: MouseEvent, pageSelector: string, mouseWidth = 0, mouseHeight = 0) => {
      const $page = getPage(event, pageSelector);

      if (!$page) {
        return false;
      }

      const { top, left, height, width } = $page.getBoundingClientRect();

      const halfMouseWidth = mouseWidth / 2;
      const halfMouseHeight = mouseHeight / 2;

      if (event.clientY > top + height - halfMouseHeight || event.clientY < top + halfMouseHeight) {
        return false;
      }

      if (event.clientX > left + width - halfMouseWidth || event.clientX < left + halfMouseWidth) {
        return false;
      }

      return true;
    },
    [],
  );

  return {
    getPage,
    getFieldPosition,
    isWithinPageBounds,
  };
};
