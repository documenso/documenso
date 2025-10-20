import type { PDFDocument } from '@cantoo/pdf-lib';
import { PDFSignature, rectangle } from '@cantoo/pdf-lib';

export const normalizeSignatureAppearances = (document: PDFDocument) => {
  const form = document.getForm();

  for (const field of form.getFields()) {
    if (field instanceof PDFSignature) {
      field.acroField.getWidgets().forEach((widget) => {
        widget.ensureAP();

        try {
          widget.getNormalAppearance();
        } catch {
          const { context } = widget.dict;

          const xobj = context.formXObject([rectangle(0, 0, 0, 0)]);

          const streamRef = context.register(xobj);

          widget.setNormalAppearance(streamRef);
        }
      });
    }
  }
};
