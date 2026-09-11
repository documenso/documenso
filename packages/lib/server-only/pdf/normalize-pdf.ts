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

  if (pdfDoc.isEncrypted) {
    // The load above already authenticated against the encryption
    // dictionary. A document that still reports itself unauthenticated
    // needs a real password, and nothing sensible can be done with it
    // here, so say that instead of the generic encryption error (#3303).
    if (!pdfDoc.isAuthenticated) {
      throw new AppError('INVALID_DOCUMENT_FILE', {
        message: 'This PDF is password protected. Re-save it without a password and try again.',
      });
    }

    // The document opened with an empty user password: this is
    // owner-password protection that only sets permission flags, the
    // common case for government forms. Rebuilding the pages into a
    // fresh document drops the encryption dictionary without needing
    // owner access.
    //
    // The rebuild does not carry the AcroForm over, so it is only safe
    // where the form was going to be flattened anyway. Today that is
    // every path except templates.
    if (!shouldFlattenForm) {
      throw new AppError('INVALID_DOCUMENT_FILE', {
        message: 'This PDF is encrypted, and removing the encryption would discard its form fields.',
      });
    }

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
