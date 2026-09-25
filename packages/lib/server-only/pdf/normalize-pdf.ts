import { PDF } from '@libpdf/core';

import { AppError } from '../../errors/app-error';

export const normalizePdf = async (pdf: Buffer, options: { flattenForm?: boolean } = {}) => {
  const shouldFlattenForm = options.flattenForm ?? true;

  const pdfDoc = await PDF.load(pdf).catch((e) => {
    console.error(`PDF normalization error: ${e.message}`);

    throw new AppError('INVALID_DOCUMENT_FILE', {
      message: 'The document is not a valid PDF',
    });
  });

  if (pdfDoc.isEncrypted) {
    // The file carries an encryption dictionary but could not be opened, so
    // it genuinely requires a password we do not have.
    if (!pdfDoc.isAuthenticated) {
      throw new AppError('INVALID_DOCUMENT_FILE', {
        message:
          'This PDF is password protected. Re-save it without a password and try again.',
      });
    }

    // Opened with an empty user password: owner-password encryption with only
    // permission flags set (the common shape for government forms). Rebuilding
    // the pages into a fresh document drops the encryption dictionary without
    // needing owner access. The rebuild discards the AcroForm, so it is only
    // safe where the form was going to be flattened anyway.
    if (!shouldFlattenForm) {
      throw new AppError('INVALID_DOCUMENT_FILE', {
        message:
          'This PDF is encrypted, and removing the encryption would discard its form fields.',
      });
    }

    const rebuilt = await pdfDoc.extractPages(
      [...Array(pdfDoc.getPageCount()).keys()],
    );

    rebuilt.flattenLayers();

    const form = rebuilt.getForm();

    if (form) {
      form.flatten();
      rebuilt.flattenAnnotations();
    }

    const normalizedPdfBytes = await rebuilt.save();

    return Buffer.from(normalizedPdfBytes);
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
