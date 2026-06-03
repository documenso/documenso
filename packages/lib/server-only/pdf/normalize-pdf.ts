// ABOUTME: Normalizes a PDF buffer by flattening layers and annotations.
// ABOUTME: Handles encrypted PDFs by decrypting them first via qpdf before normalization.
import { PDF } from '@libpdf/core';

import { AppError } from '../../errors/app-error';
import { decryptPdf } from '../utils/decrypt-pdf';
import { mergePageContentStreams } from './merge-page-content-streams';

export const normalizePdf = async (pdf: Buffer, options: { flattenForm?: boolean } = {}) => {
  const shouldFlattenForm = options.flattenForm ?? true;

  let pdfBuffer = pdf;

  const pdfDoc = await PDF.load(pdfBuffer).catch((e) => {
    console.error(`PDF normalization error: ${e.message}`);

    throw new AppError('INVALID_DOCUMENT_FILE', {
      message: 'The document is not a valid PDF',
    });
  });

  if (pdfDoc.isEncrypted) {
    pdfBuffer = await decryptPdf(pdfBuffer);

    const decryptedDoc = await PDF.load(pdfBuffer).catch((e) => {
      console.error(`PDF normalization error after decryption: ${e.message}`);
      throw new AppError('INVALID_DOCUMENT_FILE', {
        message: 'The document is not a valid PDF after decryption',
      });
    });

    decryptedDoc.flattenLayers();

    if (shouldFlattenForm) {
      decryptedDoc.flattenAnnotations();
    }

    const normalizedPdfBytes = await decryptedDoc.save();

    return Buffer.from(normalizedPdfBytes);
  }

  // Merge split content streams before flattening. `@libpdf/core`'s flatten
  // routines corrupt pages whose `/Contents` is an array of streams, blanking
  // the page behind the form fields (#28).
  mergePageContentStreams(pdfDoc);

  pdfDoc.flattenLayers();

  if (shouldFlattenForm) {
    pdfDoc.flattenAnnotations();
  }

  const normalizedPdfBytes = await pdfDoc.save();

  return Buffer.from(normalizedPdfBytes);
};
