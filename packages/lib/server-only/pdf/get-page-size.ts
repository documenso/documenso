import type { PDFPage } from '@cantoo/pdf-lib';
import type { PDF } from '@libpdf/core';

import { PDF_SIZE_A4_72PPI } from '../../constants/pdf';

const MIN_CERT_PAGE_WIDTH = 300;
const MIN_CERT_PAGE_HEIGHT = 300;

/**
 * Extracts normalized bounding box dimensions from a PDFArray or rectangle.
 */
const extractBoxDimensions = (box?: any): { x: number; y: number; width: number; height: number } | undefined => {
  if (!box) {
    return undefined;
  }

  if (typeof box.width === 'number' && typeof box.height === 'number') {
    return {
      x: box.x ?? 0,
      y: box.y ?? 0,
      width: box.width,
      height: box.height,
    };
  }

  if (typeof box.asArray === 'function') {
    const arr = box.asArray();
    if (arr.length >= 4) {
      const [x1, y1, x2, y2] = arr.map((n: any) =>
        typeof n.asNumber === 'function' ? n.asNumber() : Number(n),
      );
      return {
        x: Math.min(x1, x2),
        y: Math.min(y1, y2),
        width: Math.abs(x2 - x1),
        height: Math.abs(y2 - y1),
      };
    }
  }

  return undefined;
};

/**
 * Resolves inherited page attributes by walking up the /Pages node tree (PDF 32000-1:2008 §7.7.3.4).
 */
const getInheritedBox = (
  page: PDFPage,
  boxName: 'MediaBox' | 'CropBox',
): { x: number; y: number; width: number; height: number } | undefined => {
  try {
    let currentNode: any = page.node;
    while (currentNode) {
      if (typeof currentNode[boxName] === 'function') {
        const box = currentNode[boxName]();
        const dimensions = extractBoxDimensions(box);
        if (dimensions) {
          return dimensions;
        }
      }

      if (typeof currentNode.lookup === 'function') {
        const box = currentNode.lookup(boxName);
        const dimensions = extractBoxDimensions(box);
        if (dimensions) {
          return dimensions;
        }
      }

      currentNode = typeof currentNode.Parent === 'function' ? currentNode.Parent() : currentNode.parent;
    }
  } catch {
    // Ignore resolution errors on malformed trees.
  }

  return undefined;
};

/**
 * Gets the effective page size for PDF operations.
 *
 * Uses CropBox by default to handle rare cases where MediaBox is larger than CropBox.
 * Falls back to MediaBox when it's smaller than CropBox, following typical PDF reader behavior.
 * Resolves inherited MediaBox/CropBox from parent /Pages nodes when not defined directly on the page.
 */
export const getPageSize = (page: PDFPage) => {
  let mediaBox;
  let cropBox;

  try {
    mediaBox = extractBoxDimensions(page.getMediaBox());
  } catch {
    // MediaBox lookup can fail for malformed PDFs where the entry is not a valid PDFArray.
  }

  if (!mediaBox) {
    mediaBox = getInheritedBox(page, 'MediaBox');
  }

  try {
    cropBox = extractBoxDimensions(page.getCropBox());
  } catch {
    // CropBox lookup can fail for malformed PDFs where the entry is not a valid PDFArray.
  }

  if (!cropBox) {
    cropBox = getInheritedBox(page, 'CropBox');
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
