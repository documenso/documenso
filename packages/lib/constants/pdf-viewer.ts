// Keep these two constants in sync.
export const PDF_VIEWER_PAGE_SELECTOR = '.react-pdf__Page';
export const PDF_VIEWER_PAGE_CLASSNAME = 'react-pdf__Page z-0';

export const PDF_VIEWER_CONTENT_SELECTOR = '[data-pdf-content]';

export const getPdfPagesCount = () => {
  const pageCountAttr = document
    .querySelector(PDF_VIEWER_CONTENT_SELECTOR)
    ?.getAttribute('data-page-count');

  const totalPages = Number(pageCountAttr);

  if (!Number.isInteger(totalPages) || totalPages < 1) {
    return 0;
  }

  return totalPages;
};
