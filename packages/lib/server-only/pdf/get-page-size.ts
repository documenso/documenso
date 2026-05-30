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
  let mediaBox;
  let cropBox;

  try {
    mediaBox = page.getMediaBox();
  } catch {
    // MediaBox lookup can fail for malformed PDFs where the entry is not a valid PDFArray.
  }

  try {
    cropBox = page.getCropBox();
  } catch {
    // CropBox lookup can fail for malformed PDFs where the entry is not a valid PDFArray.
  }

  if (mediaBox && cropBox) {
    if (mediaBox.width < cropBox.width || mediaBox.height < cropBox.height) {
      return mediaBox;
    }

    return cropBox;
  }

  // If either box is missing or invalid, fall back to MediaBox if available, otherwise CropBox, or default to A4 size.
  return mediaBox || cropBox || PDF_SIZE_A4_72PPI;
};

type CropBoxRect = { x: number; y: number; width: number; height: number };

type V2OverlayPlacement = {
  pageWidth: number;
  pageHeight: number;
  translateX: number;
  translateY: number;
};

/**
 * Compute the size and draw position for a V2 field overlay so it lines up with
 * the page region the frontend (pdfjs) renders.
 *
 * pdfjs renders the page against its CropBox, whereas `@libpdf/core`'s
 * `page.width`/`page.height` report the MediaBox. When the CropBox differs from
 * the MediaBox (a smaller size and/or a non-zero origin), sizing/positioning the
 * overlay from the MediaBox offsets the fields. Sizing from the CropBox and
 * offsetting by its origin keeps fields aligned regardless of the CropBox.
 *
 * `cropBox` is the raw (unrotated) CropBox rectangle; `rotation` is the page
 * rotation in degrees (0, 90, 180 or 270).
 */
export const getV2OverlayPlacement = (
  cropBox: CropBoxRect,
  rotation: number,
): V2OverlayPlacement => {
  const isRotated90 = rotation === 90 || rotation === 270;

  const pageWidth = isRotated90 ? cropBox.height : cropBox.width;
  const pageHeight = isRotated90 ? cropBox.width : cropBox.height;

  let translateX = cropBox.x;
  let translateY = cropBox.y;

  switch (rotation) {
    case 90:
      translateX = cropBox.x + pageHeight;
      translateY = cropBox.y;
      break;
    case 180:
      translateX = cropBox.x + pageWidth;
      translateY = cropBox.y + pageHeight;
      break;
    case 270:
      translateX = cropBox.x;
      translateY = cropBox.y + pageWidth;
      break;
  }

  return { pageWidth, pageHeight, translateX, translateY };
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
