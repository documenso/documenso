import { PDFAnnotation, PDFRef } from 'pdf-lib';
import {
  PDFDict,
  type PDFDocument,
  PDFName,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  rotateInPlace,
  translate,
} from 'pdf-lib';

export const flattenAnnotations = (document: PDFDocument) => {
  const pages = document.getPages();

  for (const page of pages) {
    const annotations = page.node.Annots()?.asArray() ?? [];

    annotations.forEach((annotation) => {
      if (!(annotation instanceof PDFRef)) {
        return;
      }

      const actualAnnotation = page.node.context.lookup(annotation);

      if (!(actualAnnotation instanceof PDFDict)) {
        return;
      }

      const pdfAnnot = PDFAnnotation.fromDict(actualAnnotation);

      const appearance = pdfAnnot.ensureAP();

      // Skip annotations without a normal appearance
      if (!appearance.has(PDFName.of('N'))) {
        return;
      }

      const normalAppearance = pdfAnnot.getNormalAppearance();
      const rectangle = pdfAnnot.getRectangle();

      if (!(normalAppearance instanceof PDFRef)) {
        // Not sure how to get the reference to the normal appearance yet
        // so we should skip this annotation for now
        return;
      }

      const xobj = page.node.newXObject('FlatAnnot', normalAppearance);

      const operators = [
        pushGraphicsState(),
        translate(rectangle.x, rectangle.y),
        ...rotateInPlace({ ...rectangle, rotation: 0 }),
        drawObject(xobj),
        popGraphicsState(),
      ].filter((op) => !!op);

      page.pushOperators(...operators);

      page.node.removeAnnot(annotation);
    });
  }
};
