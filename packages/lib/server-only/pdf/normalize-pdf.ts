import { PDF } from '@libpdf/core';

import { AppError } from '../../errors/app-error';
import { mergePageContentStreams } from './merge-page-content-streams';

export const normalizePdf = async (pdf: Buffer, options: { flattenForm?: boolean } = {}) => {
  const shouldFlattenForm = options.flattenForm ?? true;

  const pdfDoc = await PDF.load(pdf).catch((e) => {
    console.error(`PDF normalization error: ${e.message}`);

    throw new AppError('INVALID_DOCUMENT_FILE', {
      message: 'The document is not a valid PDF',
    });
  });

  if (pdfDoc.isEncrypted) {
    throw new AppError('INVALID_DOCUMENT_FILE', {
      message: 'The document is encrypted',
    });
  }

  // Merge split content streams before flattening. `@libpdf/core`'s flatten
  // routines corrupt pages whose `/Contents` is an array of streams, blanking
  // the page behind the form fields (#28).
  mergePageContentStreams(pdfDoc);

  pdfDoc.flattenLayers();

  const form = pdfDoc.getForm();

  if (shouldFlattenForm && form) {
    form.flatten();
    pdfDoc.flattenAnnotations();
  }

  const normalizedPdfBytes = await pdfDoc.save();

  return Buffer.from(normalizedPdfBytes);
};
