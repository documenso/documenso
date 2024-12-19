import type { PDFField, PDFWidgetAnnotation } from 'pdf-lib';
import {
  PDFCheckBox,
  PDFDict,
  type PDFDocument,
  PDFName,
  PDFRadioGroup,
  PDFRef,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  rotateInPlace,
  translate,
} from 'pdf-lib';

export const removeOptionalContentGroups = (document: PDFDocument) => {
  const context = document.context;
  const catalog = context.lookup(context.trailerInfo.Root);
  if (catalog instanceof PDFDict) {
    catalog.delete(PDFName.of('OCProperties'));
  }
};

export const flattenForm = (document: PDFDocument) => {
  removeOptionalContentGroups(document);

  const form = document.getForm();

  form.updateFieldAppearances();

  for (const field of form.getFields()) {
    for (const widget of field.acroField.getWidgets()) {
      flattenWidget(document, field, widget);
    }

    try {
      form.removeField(field);
    } catch (error) {
      console.error(error);
    }
  }
};

const getPageForWidget = (document: PDFDocument, widget: PDFWidgetAnnotation) => {
  const pageRef = widget.P();

  let page = document.getPages().find((page) => page.ref === pageRef);

  if (!page) {
    const widgetRef = document.context.getObjectRef(widget.dict);

    if (!widgetRef) {
      return null;
    }

    page = document.findPageForAnnotationRef(widgetRef);

    if (!page) {
      return null;
    }
  }

  return page;
};

const getAppearanceRefForWidget = (field: PDFField, widget: PDFWidgetAnnotation) => {
  try {
    const normalAppearance = widget.getNormalAppearance();
    let normalAppearanceRef: PDFRef | null = null;

    if (normalAppearance instanceof PDFRef) {
      normalAppearanceRef = normalAppearance;
    }

    if (
      normalAppearance instanceof PDFDict &&
      (field instanceof PDFCheckBox || field instanceof PDFRadioGroup)
    ) {
      const value = field.acroField.getValue();
      const ref = normalAppearance.get(value) ?? normalAppearance.get(PDFName.of('Off'));

      if (ref instanceof PDFRef) {
        normalAppearanceRef = ref;
      }
    }

    return normalAppearanceRef;
  } catch (error) {
    console.error(error);

    return null;
  }
};

const flattenWidget = (document: PDFDocument, field: PDFField, widget: PDFWidgetAnnotation) => {
  try {
    const page = getPageForWidget(document, widget);

    if (!page) {
      return;
    }

    const appearanceRef = getAppearanceRefForWidget(field, widget);

    if (!appearanceRef) {
      return;
    }

    const xObjectKey = page.node.newXObject('FlatWidget', appearanceRef);

    const rectangle = widget.getRectangle();
    const operators = [
      pushGraphicsState(),
      translate(rectangle.x, rectangle.y),
      ...rotateInPlace({ ...rectangle, rotation: 0 }),
      drawObject(xObjectKey),
      popGraphicsState(),
    ].filter((op) => !!op);

    page.pushOperators(...operators);
  } catch (error) {
    console.error(error);
  }
};
