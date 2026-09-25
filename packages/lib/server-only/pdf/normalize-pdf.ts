import { PDF } from '@libpdf/core';

import { AppError } from '../../errors/app-error';

export const normalizePdf = async (pdf: Buffer, options: { flattenForm?: boolean } = {}) => {
  const shouldFlattenForm = options.flattenForm ?? true;

  let pdfDoc = await PDF.load(pdf).catch((e) => {
    console.error(`PDF normalization error: ${e.message}`);

    throw new AppError('INVALID_DOCUMENT_FILE', {
      message: 'The document is not a valid PDF',
    });
  });

  if (!pdfDoc.isAuthenticated) {
    throw new AppError('INVALID_DOCUMENT_FILE', {
      message: 'The document is encrypted',
    });
  }

  if (pdfDoc.isEncrypted && shouldFlattenForm) {
    pdfDoc = await pdfDoc.extractPages([...Array(pdfDoc.getPageCount()).keys()]);
  }

  pdfDoc.flattenLayers();

  const form = pdfDoc.getForm();

  if (shouldFlattenForm && form) {
    form.flatten();
    pdfDoc.flattenAnnotations();
  }

  const normalizedPdfBytes = await pdfDoc.save();

  return Buffer.from(normalizedPdfBytes);
};
