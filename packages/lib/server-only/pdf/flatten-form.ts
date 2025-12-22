import type { PDFField, PDFWidgetAnnotation } from '@cantoo/pdf-lib';
import {
  PDFCheckBox,
  PDFDict,
  type PDFDocument,
  PDFName,
  PDFNumber,
  PDFRadioGroup,
  PDFRef,
  PDFStream,
  drawObject,
  popGraphicsState,
  pushGraphicsState,
  rotateInPlace,
  translate,
} from '@cantoo/pdf-lib';
import fontkit from '@pdf-lib/fontkit';

import { NEXT_PRIVATE_INTERNAL_WEBAPP_URL } from '../../constants/app';

export const removeOptionalContentGroups = (document: PDFDocument) => {
  const context = document.context;
  const catalog = context.lookup(context.trailerInfo.Root);
  if (catalog instanceof PDFDict) {
    catalog.delete(PDFName.of('OCProperties'));
  }
};

export const flattenForm = async (document: PDFDocument) => {
  removeOptionalContentGroups(document);

  const form = document.getForm();

  const fontNoto = await fetch(`${NEXT_PRIVATE_INTERNAL_WEBAPP_URL()}/fonts/noto-sans.ttf`).then(
    async (res) => res.arrayBuffer(),
  );

  document.registerFontkit(fontkit);

  const font = await document.embedFont(fontNoto);

  form.updateFieldAppearances(font);

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

/**
 * Ensures that an appearance stream has the required dictionary entries to be
 * used as a Form XObject. Some PDFs have appearance streams that are missing
 * the /Subtype /Form entry, which causes Adobe Reader to fail to render them.
 *
 * Per PDF spec, a Form XObject stream requires:
 * - /Subtype /Form (required)
 * - /BBox (required, but should already exist for appearance streams)
 * - /FormType 1 (optional, defaults to 1)
 */
const normalizeAppearanceStream = (document: PDFDocument, appearanceRef: PDFRef) => {
  const appearanceStream = document.context.lookup(appearanceRef);

  if (!(appearanceStream instanceof PDFStream)) {
    return;
  }

  const dict = appearanceStream.dict;

  // Ensure /Subtype /Form is set (required for XObject Form)
  if (!dict.has(PDFName.of('Subtype'))) {
    dict.set(PDFName.of('Subtype'), PDFName.of('Form'));
  }

  // Ensure /FormType is set (optional, but good practice)
  if (!dict.has(PDFName.of('FormType'))) {
    dict.set(PDFName.of('FormType'), PDFNumber.of(1));
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

    // Ensure the appearance stream has required XObject Form dictionary entries
    normalizeAppearanceStream(document, appearanceRef);

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
