import { PDFDocument } from '@cantoo/pdf-lib';

import { AppError } from '../../errors/app-error';
import { flattenAnnotations } from './flatten-annotations';
import { flattenForm, removeOptionalContentGroups } from './flatten-form';

export const normalizePdf = async (pdf: Buffer) => {
  const pdfDoc = await PDFDocument.load(pdf).catch((e) => {
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

  removeOptionalContentGroups(pdfDoc);
  await flattenForm(pdfDoc);
  flattenAnnotations(pdfDoc);

  return Buffer.from(await pdfDoc.save());
};
