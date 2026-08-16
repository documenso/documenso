import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { PDF } from '@libpdf/core';
import { groupBy } from 'remeda';

import { insertFieldInPDFV2 } from './insert-field-in-pdf-v2';

type GeneratePartialSignedPdfOptions = {
  pdfData: Uint8Array;
  fields: FieldWithSignature[];
};

/**
 * Generates a PDF with all currently-inserted fields burned in. Used to serve
 * partially signed envelopes during the `PENDING` window before the seal job
 * has had a chance to produce the final sealed PDF.
 *
 * No PKI signature, no certificate page, no audit log appendix - this is a
 * preview of the in-progress envelope, not a final executed document.
 */
export const generatePartialSignedPdf = async ({ pdfData, fields }: GeneratePartialSignedPdfOptions) => {
  const pdfDoc = await PDF.load(pdfData);

  pdfDoc.flattenAll();
  pdfDoc.upgradeVersion('1.7');

  const fieldsGroupedByPage = groupBy(fields, (field) => field.page);

  for (const [pageNumber, pageFields] of Object.entries(fieldsGroupedByPage)) {
    const page = pdfDoc.getPage(Number(pageNumber) - 1);

    if (!page) {
      throw new Error(`Page ${pageNumber} does not exist`);
    }

    const pageWidth = page.width;
    const pageHeight = page.height;
    const overlayBytes = await insertFieldInPDFV2({
      pageWidth,
      pageHeight,
      fields: pageFields,
    });

    const overlayPdf = await PDF.load(overlayBytes);
    const embeddedPage = await pdfDoc.embedPage(overlayPdf, 0);

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

    page.drawPage(embeddedPage, {
      x: translateX,
      y: translateY,
      rotate: {
        angle: page.rotation,
      },
    });
  }

  pdfDoc.flattenAll();

  return await pdfDoc.save({ useXRefStream: true });
};
