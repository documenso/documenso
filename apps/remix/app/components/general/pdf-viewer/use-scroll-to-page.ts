import { type RefObject, useEffect } from 'react';

/**
 * Watch for `data-scroll-to-page` attribute changes on a container element.
 *
 * When set (by `validateFieldsInserted`, `handleOnNextFieldClick`, or similar),
 * scroll the virtual list to the requested page and clear the attribute.
 *
 * This is the communication bridge between field validation logic (which knows
 * which page to scroll to) and the virtual list (which knows how to scroll).
 */
export const useScrollToPage = (
  contentRef: RefObject<HTMLElement | null>,
  scrollToItem: (index: number) => void,
) => {
  useEffect(() => {
    const el = contentRef.current;

    if (!el) {
      return;
    }

    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'attributes' && mutation.attributeName === 'data-scroll-to-page') {
          const raw = el.getAttribute('data-scroll-to-page');

          if (raw) {
            const pageNumber = parseInt(raw, 10);

            if (!isNaN(pageNumber) && pageNumber >= 1) {
              // Pages are 1-indexed, virtual list items are 0-indexed.
              scrollToItem(pageNumber - 1);
            }

            el.removeAttribute('data-scroll-to-page');
          }
        }
      }
    });

    observer.observe(el, { attributes: true, attributeFilter: ['data-scroll-to-page'] });

    return () => observer.disconnect();
  }, [contentRef, scrollToItem]);
};
