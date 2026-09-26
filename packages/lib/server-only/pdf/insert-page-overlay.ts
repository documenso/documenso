import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import type { PDF } from '@libpdf/core';
import { PDF as PDFDocument } from '@libpdf/core';
import { groupBy, unique } from 'remeda';

import type { ContentImageMap } from '../../universal/content-renderer/content-renderer';
import { insertFieldInPDFV2, type OverlayContent } from './insert-field-in-pdf-v2';

type InsertPageOverlaysOptions = {
  pdfDoc: PDF;
  fields: FieldWithSignature[];
  contents?: OverlayContent[];

  /**
   * The loaded images of the image contents, see `loadContentImages`.
   */
  images?: ContentImageMap;
};

/**
 * Render the fields and contents of every page which has any into an overlay
 * and draw it onto the page, where the client renders them. Each page is
 * touched exactly once.
 */
export const insertPageOverlays = async ({ pdfDoc, fields, contents = [], images }: InsertPageOverlaysOptions) => {
  const fieldsByPage = groupBy(fields, (field) => field.page);
  const contentsByPage = groupBy(contents, (content) => content.contentMeta.page);

  // Object keys are always strings, so the page numbers are parsed back.
  const pageNumbers = unique([...Object.keys(fieldsByPage), ...Object.keys(contentsByPage)].map(Number));

  for (const pageNumber of pageNumbers) {
    const page = pdfDoc.getPage(pageNumber - 1);

    if (!page) {
      throw new Error(`Page ${pageNumber} does not exist`);
    }

    const pageWidth = page.width;
    const pageHeight = page.height;

    const overlayBytes = await insertFieldInPDFV2({
      pageWidth,
      pageHeight,
      fields: fieldsByPage[pageNumber] ?? [],
      contents: contentsByPage[pageNumber] ?? [],
      images,
    });

    const overlayPdf = await PDFDocument.load(overlayBytes);

    const embeddedPage = await pdfDoc.embedPage(overlayPdf, 0);

    // Rotate the page to the orientation that the react-pdf renders on the frontend.
    let translateX = 0;
    let translateY = 0;

    switch (page.rotation) {
      case 90:
        translateX = pageHeight;
        translateY = 0;
        break;
      case 180:
        translateX = pageWidth;
        translateY = pageHeight;
        break;
      case 270:
        translateX = 0;
        translateY = pageWidth;
        break;
    }

    // Draw the overlay on the page
    page.drawPage(embeddedPage, {
      x: translateX,
      y: translateY,
      rotate: {
        angle: page.rotation,
      },
    });
  }
};
