import {
  PDFCheckBox,
  PDFDocument,
  PDFDropdown,
  PDFRadioGroup,
  PDFTextField,
} from '@cantoo/pdf-lib';

export type InsertFormValuesInPdfOptions = {
  pdf: Buffer;
  formValues: Record<string, string | boolean | number>;
};

export const insertFormValuesInPdf = async ({ pdf, formValues }: InsertFormValuesInPdfOptions) => {
  const doc = await PDFDocument.load(pdf);

  const form = doc.getForm();

  if (!form) {
    return pdf;
  }

  for (const [key, value] of Object.entries(formValues)) {
    try {
      const field = form.getField(key);

      if (!field) {
        continue;
      }

      if (typeof value === 'boolean' && field instanceof PDFCheckBox) {
        if (value) {
          field.check();
        } else {
          field.uncheck();
        }
      }

      if (field instanceof PDFTextField) {
        field.setText(value.toString());
      }

      if (field instanceof PDFDropdown) {
        field.select(value.toString());
      }

      if (field instanceof PDFRadioGroup) {
        field.select(value.toString());
      }
    } catch (err) {
      if (err instanceof Error) {
        console.error(`Error setting value for field ${key}: ${err.message}`);
      } else {
        console.error(`Error setting value for field ${key}`);
      }
    }
  }

  return await doc.save().then((buf) => Buffer.from(buf));
};
