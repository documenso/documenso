import { PDF_VIEWER_CONTENT_SELECTOR, PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import type { Field } from '@prisma/client';

/**
 * Marks an element which is fixed to the bottom of the viewport and covers the document,
 * so fields underneath it are not treated as visible.
 */
export const SIGNING_VIEWPORT_OVERLAY_ATTRIBUTE = 'data-signing-viewport-overlay';

type SigningFieldPosition = Pick<Field, 'envelopeItemId' | 'page' | 'positionX' | 'positionY' | 'width' | 'height'>;

type ScrollToSigningFieldOptions = {
  field: SigningFieldPosition;
  currentEnvelopeItemId: string | undefined;
  setCurrentEnvelopeItem: (envelopeItemId: string) => void;
  /**
   * Leave the page where it is when the field is already fully on screen. Otherwise the
   * field is always centred, so asking for a field visibly moves to it.
   */
  skipIfVisible?: boolean;
};

type ViewportBounds = {
  top: number;
  bottom: number;
  left: number;
  right: number;
};

/**
 * Scrolls the signing page so the field is centred vertically and within view
 * horizontally, switching to the field's envelope item first if needed.
 */
export const scrollToSigningField = ({
  field,
  currentEnvelopeItemId,
  setCurrentEnvelopeItem,
  skipIfVisible = false,
}: ScrollToSigningFieldOptions) => {
  const isEnvelopeItemSwitch = field.envelopeItemId !== currentEnvelopeItemId;

  if (isEnvelopeItemSwitch) {
    setCurrentEnvelopeItem(field.envelopeItemId);
  }

  // Give the viewer a moment to render the target pages before scrolling.
  setTimeout(
    () => {
      const $page = document.querySelector<HTMLElement>(
        `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${field.page}"]`,
      );

      if (!$page) {
        // Page not in the DOM yet (virtualised away), so ask the viewer to scroll to it.
        document.querySelector(PDF_VIEWER_CONTENT_SELECTOR)?.setAttribute('data-scroll-to-page', String(field.page));

        return;
      }

      const fieldBounds = getFieldViewportBounds($page, field);
      const $scrollContainer = findScrollContainer($page);
      const visibleBounds = getVisibleViewportBounds($scrollContainer);

      const isFieldVisible =
        fieldBounds.top >= visibleBounds.top &&
        fieldBounds.bottom <= visibleBounds.bottom &&
        fieldBounds.left >= visibleBounds.left &&
        fieldBounds.right <= visibleBounds.right;

      if (skipIfVisible && isFieldVisible) {
        return;
      }

      const fieldCentre = (fieldBounds.top + fieldBounds.bottom) / 2;
      const visibleCentre = (visibleBounds.top + visibleBounds.bottom) / 2;

      const top = fieldCentre - visibleCentre;
      const left = getNearestScrollOffset(fieldBounds.left, fieldBounds.right, visibleBounds.left, visibleBounds.right);

      if (top === 0 && left === 0) {
        return;
      }

      ($scrollContainer ?? window).scrollBy({ top, left, behavior: 'smooth' });
    },
    isEnvelopeItemSwitch ? 150 : 50,
  );
};

/**
 * The field's extent in viewport coordinates.
 */
const getFieldViewportBounds = ($page: HTMLElement, field: SigningFieldPosition): ViewportBounds => {
  const pageRect = $page.getBoundingClientRect();

  const top = pageRect.top + (Number(field.positionY) / 100) * pageRect.height;
  const left = pageRect.left + (Number(field.positionX) / 100) * pageRect.width;

  return {
    top,
    bottom: top + (Number(field.height) / 100) * pageRect.height,
    left,
    right: left + (Number(field.width) / 100) * pageRect.width,
  };
};

/**
 * The part of the viewport in which page content can be seen: the window, narrowed to the
 * scrollable container the pages live in, minus anything fixed over the bottom of it.
 */
const getVisibleViewportBounds = ($scrollContainer: HTMLElement | null): ViewportBounds => {
  const bounds: ViewportBounds = {
    top: 0,
    bottom: window.innerHeight,
    left: 0,
    right: window.innerWidth,
  };

  if ($scrollContainer) {
    const containerRect = $scrollContainer.getBoundingClientRect();

    // The client box rather than the border box, so scrollbars are not counted as visible.
    const containerTop = containerRect.top + $scrollContainer.clientTop;
    const containerLeft = containerRect.left + $scrollContainer.clientLeft;

    bounds.top = Math.max(bounds.top, containerTop);
    bounds.bottom = Math.min(bounds.bottom, containerTop + $scrollContainer.clientHeight);
    bounds.left = Math.max(bounds.left, containerLeft);
    bounds.right = Math.min(bounds.right, containerLeft + $scrollContainer.clientWidth);
  }

  for (const $overlay of document.querySelectorAll<HTMLElement>(`[${SIGNING_VIEWPORT_OVERLAY_ATTRIBUTE}]`)) {
    const overlayRect = $overlay.getBoundingClientRect();

    // A hidden overlay has no size. One which covers the whole band leaves nowhere to
    // scroll the field to, so it is ignored rather than collapsing the band.
    if (overlayRect.height > 0 && overlayRect.top > bounds.top) {
      bounds.bottom = Math.min(bounds.bottom, overlayRect.top);
    }
  }

  return bounds;
};

/**
 * The smallest scroll along one axis which brings a range into view. Zero if it already
 * is, and the start is favoured when the range is larger than the visible area.
 */
const getNearestScrollOffset = (start: number, end: number, visibleStart: number, visibleEnd: number) => {
  if (start >= visibleStart && end <= visibleEnd) {
    return 0;
  }

  const isLargerThanVisibleArea = end - start > visibleEnd - visibleStart;

  if (start < visibleStart || isLargerThanVisibleArea) {
    return start - visibleStart;
  }

  return end - visibleEnd;
};

const findScrollContainer = ($element: HTMLElement): HTMLElement | null => {
  let $current = $element.parentElement;

  while ($current) {
    const { overflowY } = window.getComputedStyle($current);

    if (overflowY === 'auto' || overflowY === 'scroll') {
      return $current;
    }

    $current = $current.parentElement;
  }

  return null;
};
