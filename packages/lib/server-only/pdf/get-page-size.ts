import type { PDFPage } from '@cantoo/pdf-lib';

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
