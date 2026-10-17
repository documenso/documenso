import { PDF_VIEWER_CONTENT_SELECTOR, PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';
import type { Field } from '@prisma/client';

type SigningFieldPosition = Pick<Field, 'envelopeItemId' | 'page' | 'positionY' | 'height'>;

type ScrollToSigningFieldOptions = {
  field: SigningFieldPosition;
  currentEnvelopeItemId: string | undefined;
  setCurrentEnvelopeItem: (envelopeItemId: string) => void;
};

/**
 * Scrolls the signing page so the field is centred, switching to the field's envelope
 * item first if needed. Does nothing if the field is already fully on screen.
 */
export const scrollToSigningField = ({
  field,
  currentEnvelopeItemId,
  setCurrentEnvelopeItem,
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

      const { top: fieldTop, bottom: fieldBottom } = getFieldViewportBounds($page, field);
      const $scrollContainer = findScrollContainer($page);

      const { top: visibleTop, bottom: visibleBottom } = getVisibleViewportBounds($scrollContainer);

      if (fieldTop >= visibleTop && fieldBottom <= visibleBottom) {
        return;
      }

      const fieldCentre = (fieldTop + fieldBottom) / 2;
      const visibleCentre = (visibleTop + visibleBottom) / 2;

      ($scrollContainer ?? window).scrollBy({ top: fieldCentre - visibleCentre, behavior: 'smooth' });
    },
    isEnvelopeItemSwitch ? 150 : 50,
  );
};

/**
 * The field's vertical extent in viewport coordinates.
 */
const getFieldViewportBounds = ($page: HTMLElement, field: SigningFieldPosition) => {
  const pageRect = $page.getBoundingClientRect();

  const top = pageRect.top + (Number(field.positionY) / 100) * pageRect.height;
  const bottom = top + (Number(field.height) / 100) * pageRect.height;

  return { top, bottom };
};

/**
 * The vertical band of the viewport in which page content is visible: the window,
 * narrowed to the scrollable container the pages live in when there is one.
 */
const getVisibleViewportBounds = ($scrollContainer: HTMLElement | null) => {
  let top = 0;
  let bottom = window.innerHeight;

  if ($scrollContainer) {
    const containerRect = $scrollContainer.getBoundingClientRect();

    top = Math.max(top, containerRect.top);
    bottom = Math.min(bottom, containerRect.bottom);
  }

  return { top, bottom };
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
