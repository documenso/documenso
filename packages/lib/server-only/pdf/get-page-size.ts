import type { PDFPage } from '@cantoo/pdf-lib';
import type { PDF } from '@libpdf/core';

import { PDF_SIZE_A4_72PPI } from '../../constants/pdf';

const MIN_CERT_PAGE_WIDTH = 300;
const MIN_CERT_PAGE_HEIGHT = 300;

/**
 * Gets the effective page size for PDF operations.
 *
 * Uses CropBox by default to handle rare cases where MediaBox is larger than CropBox.
 * Falls back to MediaBox when it's smaller than CropBox, following typical PDF reader behavior.
 */
export const getPageSize = (page: PDFPage) => {
  const cropBox = page.getCropBox();
  const mediaBox = page.getMediaBox();

  if (mediaBox.width < cropBox.width || mediaBox.height < cropBox.height) {
    return mediaBox;
  }

  return cropBox;
};

export const getLastPageDimensions = (pdfDoc: PDF): { width: number; height: number } => {
  const lastPage = pdfDoc.getPage(pdfDoc.getPageCount() - 1);

  if (!lastPage) {
    return PDF_SIZE_A4_72PPI;
  }

  const width = Math.round(lastPage.width);
  const height = Math.round(lastPage.height);

  if (width < MIN_CERT_PAGE_WIDTH || height < MIN_CERT_PAGE_HEIGHT) {
    return PDF_SIZE_A4_72PPI;
  }

  return { width, height };
};
