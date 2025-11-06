import { PDFDocument } from '@cantoo/pdf-lib';

import { removePlaceholdersFromPDF } from './auto-place-fields';
import { flattenAnnotations } from './flatten-annotations';
import { flattenForm, removeOptionalContentGroups } from './flatten-form';

export const normalizePdf = async (pdf: Buffer) => {
  const pdfDoc = await PDFDocument.load(pdf).catch(() => null);

  if (!pdfDoc) {
    return pdf;
  }

  removeOptionalContentGroups(pdfDoc);
  await flattenForm(pdfDoc);
  flattenAnnotations(pdfDoc);
  const pdfWithoutPlaceholders = await removePlaceholdersFromPDF(pdf);

  return pdfWithoutPlaceholders;
};
