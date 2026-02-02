import { PDF } from '@libpdf/core';

export type InsertFormValuesInPdfOptions = {
  pdf: Buffer;
  formValues: Record<string, string | boolean | number>;
};

export const insertFormValuesInPdf = async ({ pdf, formValues }: InsertFormValuesInPdfOptions) => {
  const doc = await PDF.load(pdf);

  const form = doc.getForm();

  if (!form) {
    return pdf;
  }

  const filledForm = Object.entries(formValues).map(([key, value]) => [
    key,
    typeof value === 'boolean' ? value : value.toString(),
  ]);

  form.fill(Object.fromEntries(filledForm));

  return await doc.save({ incremental: true }).then((buf) => Buffer.from(buf));
};
