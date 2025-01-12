import { PDFDocument } from 'pdf-lib';

import { flattenAnnotations } from './flatten-annotations';
import { flattenForm, removeOptionalContentGroups } from './flatten-form';

export const normalizePdf = async (pdf: Buffer) => {
  const pdfDoc = await PDFDocument.load(pdf).catch(() => null);

  if (!pdfDoc) {
    return pdf;
  }

  removeOptionalContentGroups(pdfDoc);
  flattenForm(pdfDoc);
  flattenAnnotations(pdfDoc);

  return Buffer.from(await pdfDoc.save());
};
