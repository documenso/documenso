import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import type { PDF, PDFPage, PdfObject } from '@libpdf/core';
import { PDF as PDFDocument, PdfArray, PdfDict, PdfNumber } from '@libpdf/core';
import { match } from 'ts-pattern';

import type { ContentImageMap } from '../../universal/content-renderer/content-renderer';
import { insertFieldInPDFV2, type OverlayContent } from './insert-field-in-pdf-v2';

type Box = {
  x: number;
  y: number;
  width: number;
  height: number;
};

type PageRotation = 0 | 90 | 180 | 270;

/**
 * The default page box when a PDF has no MediaBox (US Letter), matching pdf.js.
 */
const DEFAULT_MEDIA_BOX: Box = { x: 0, y: 0, width: 612, height: 792 };

/**
 * Resolve a page attribute, walking up the `/Pages` tree for inherited values.
 *
 * MediaBox, CropBox and Rotate are inheritable per the PDF spec and are very
 * commonly defined once on the root pages node. libpdf's page accessors only
 * read the page's own dictionary, so they fall back to defaults for inherited
 * values, whereas pdf.js (used to render the page on the client) resolves them.
 */
const getInheritedPageAttribute = (pdfDoc: PDF, page: PDFPage, key: string): PdfObject | undefined => {
  const resolve = (ref: Parameters<PDF['getObject']>[0]) => pdfDoc.getObject(ref);

  let current: PdfDict | null = page.dict;
  const visited = new Set<PdfDict>();

  while (current && !visited.has(current)) {
    visited.add(current);

    const value = current.get(key, resolve);

    if (value !== undefined) {
      return value;
    }

    const parentRef = current.getRef('Parent');

    if (!parentRef) {
      break;
    }

    const parent = pdfDoc.getObject(parentRef);

    current = parent instanceof PdfDict ? parent : null;
  }

  return undefined;
};

/**
 * Read a page box attribute (`[x1 y1 x2 y2]`) as a normalized box.
 */
const getPageBox = (pdfDoc: PDF, page: PDFPage, key: string): Box | null => {
  const value = getInheritedPageAttribute(pdfDoc, page, key);

  if (!(value instanceof PdfArray) || value.length < 4) {
    return null;
  }

  const resolve = (ref: Parameters<PDF['getObject']>[0]) => pdfDoc.getObject(ref);

  const numbers = [0, 1, 2, 3].map((index) => {
    const item = value.at(index, resolve);

    return item instanceof PdfNumber ? item.value : null;
  });

  if (numbers.some((number) => number === null || !Number.isFinite(number))) {
    return null;
  }

  const [x1, y1, x2, y2] = numbers as number[];

  const box = {
    x: Math.min(x1, x2),
    y: Math.min(y1, y2),
    width: Math.abs(x2 - x1),
    height: Math.abs(y2 - y1),
  };

  // Degenerate boxes are treated as missing, matching pdf.js.
  if (box.width === 0 || box.height === 0) {
    return null;
  }

  return box;
};

/**
 * The page rotation, resolving inherited values and normalizing to a multiple
 * of 90 the same way pdf.js does (invalid values fall back to 0).
 */
export const getPageRotation = (pdfDoc: PDF, page: PDFPage): PageRotation => {
  const value = getInheritedPageAttribute(pdfDoc, page, 'Rotate');

  if (!(value instanceof PdfNumber)) {
    return 0;
  }

  let rotation = value.value % 360;

  if (rotation < 0) {
    rotation += 360;
  }

  return match(rotation)
    .with(90, () => 90 as const)
    .with(180, () => 180 as const)
    .with(270, () => 270 as const)
    .otherwise(() => 0 as const);
};

/**
 * The visible box of a page in PDF user space: the CropBox intersected with
 * the MediaBox, falling back to the MediaBox.
 *
 * This is the exact box pdf.js uses as the page viewport on the client, so
 * anything positioned as a percentage of the rendered page must be placed
 * relative to this box, not to the user space origin.
 */
export const getPageVisibleBox = (pdfDoc: PDF, page: PDFPage): Box => {
  const mediaBox = getPageBox(pdfDoc, page, 'MediaBox') ?? DEFAULT_MEDIA_BOX;
  const cropBox = getPageBox(pdfDoc, page, 'CropBox') ?? mediaBox;

  const x1 = Math.max(mediaBox.x, cropBox.x);
  const y1 = Math.max(mediaBox.y, cropBox.y);
  const x2 = Math.min(mediaBox.x + mediaBox.width, cropBox.x + cropBox.width);
  const y2 = Math.min(mediaBox.y + mediaBox.height, cropBox.y + cropBox.height);

  if (x2 - x1 <= 0 || y2 - y1 <= 0) {
    return mediaBox;
  }

  return { x: x1, y: y1, width: x2 - x1, height: y2 - y1 };
};

/**
 * The size of the page as displayed, accounting for the page rotation.
 *
 * Matches the pdf.js viewport size at scale 1.
 */
export const getPageDisplaySize = (pdfDoc: PDF, page: PDFPage) => {
  const box = getPageVisibleBox(pdfDoc, page);
  const rotation = getPageRotation(pdfDoc, page);
  const isRotated = rotation === 90 || rotation === 270;

  return {
    width: isRotated ? box.height : box.width,
    height: isRotated ? box.width : box.height,
  };
};

type InsertPageOverlayOptions = {
  pdfDoc: PDF;
  page: PDFPage;
  fields: FieldWithSignature[];
  contents?: OverlayContent[];

  /**
   * The loaded images of the image contents, see `loadContentImages`.
   */
  images?: ContentImageMap;
};

/**
 * Render the fields and contents of a page into an overlay and draw it onto
 * the page, where the client renders them.
 *
 * The overlay is rendered in the page's display frame (the rotated visible
 * box, with the origin at the top left) and then drawn rotated back into the
 * page's own orientation, anchored at the corner of the visible box which
 * corresponds to the display origin for that rotation.
 *
 * Note: Skia writes the overlay page at a whole point size. On pages with a
 * fractional size this leaves a residual of at most half a point, which is
 * accepted rather than compensated for.
 */
export const insertPageOverlay = async ({ pdfDoc, page, fields, contents = [], images }: InsertPageOverlayOptions) => {
  const box = getPageVisibleBox(pdfDoc, page);
  const rotation = getPageRotation(pdfDoc, page);
  const { width, height } = getPageDisplaySize(pdfDoc, page);

  const overlayBytes = await insertFieldInPDFV2({
    pageWidth: width,
    pageHeight: height,
    fields,
    contents,
    images,
  });

  const overlayPdf = await PDFDocument.load(overlayBytes);
  const embedded = await pdfDoc.embedPage(overlayPdf, 0);

  const { x, y } = match(rotation)
    .with(0, () => ({ x: box.x, y: box.y }))
    .with(90, () => ({ x: box.x + height, y: box.y }))
    .with(180, () => ({ x: box.x + width, y: box.y + height }))
    .with(270, () => ({ x: box.x, y: box.y + width }))
    .exhaustive();

  page.drawPage(embedded, {
    x,
    y,
    rotate: {
      angle: rotation,
    },
  });
};
