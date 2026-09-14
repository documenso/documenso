import type { FieldWithSignature } from '@documenso/prisma/types/field-with-signature';
import { PDF } from '@libpdf/core';
import type { EnvelopeContent } from '@prisma/client';

import { loadContentImages } from '../data-content/load-content-images';
import { groupPageOverlays } from './group-page-overlays';
import { insertPageOverlay } from './insert-page-overlay';

type GeneratePartialSignedPdfOptions = {
  pdfData: Uint8Array;
  fields: FieldWithSignature[];
  contents?: EnvelopeContent[];
};

/**
 * Generates a PDF with all currently-inserted fields (and the authored
 * contents) burned in. Used to serve partially signed envelopes during the
 * `PENDING` window before the seal job has had a chance to produce the final
 * sealed PDF.
 *
 * No PKI signature, no certificate page, no audit log appendix - this is a
 * preview of the in-progress envelope, not a final executed document.
 */
export const generatePartialSignedPdf = async ({ pdfData, fields, contents = [] }: GeneratePartialSignedPdfOptions) => {
  const pdfDoc = await PDF.load(pdfData);

  pdfDoc.flattenAll();
  pdfDoc.upgradeVersion('1.7');

  const pageOverlays = groupPageOverlays(fields, contents);
  const images = await loadContentImages(contents);

  for (const [pageNumber, { fields: pageFields, contents: pageContents }] of pageOverlays) {
    const page = pdfDoc.getPage(pageNumber - 1);

    if (!page) {
      throw new Error(`Page ${pageNumber} does not exist`);
    }

    await insertPageOverlay({ pdfDoc, page, fields: pageFields, contents: pageContents, images });
  }

  pdfDoc.flattenAll();

  return await pdfDoc.save({ useXRefStream: true });
};
