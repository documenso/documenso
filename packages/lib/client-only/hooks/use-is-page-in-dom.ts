import { useEffect, useState } from 'react';

import { PDF_VIEWER_PAGE_SELECTOR } from '@documenso/lib/constants/pdf-viewer';

/**
 * Returns whether the PDF page element for the given page number is currently
 * present in the DOM. With virtual list rendering only pages near the viewport
 * are mounted, so this hook lets consumers skip rendering when their page is
 * virtualised away.
 */
export const useIsPageInDom = (pageNumber: number) => {
  const [isPageInDom, setIsPageInDom] = useState(false);

  useEffect(() => {
    const selector = `${PDF_VIEWER_PAGE_SELECTOR}[data-page-number="${pageNumber}"]`;

    setIsPageInDom(document.querySelector(selector) !== null);

    const observer = new MutationObserver(() => {
      setIsPageInDom(document.querySelector(selector) !== null);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, [pageNumber]);

  return isPageInDom;
};
