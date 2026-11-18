import {
  type CheckboxField,
  type DropdownField,
  PDF,
  type PDFPage,
  type SignatureField,
  type TextField,
} from '@libpdf/core';
import { FieldType } from '@prisma/client';
import { match } from 'ts-pattern';

import {
  FIELD_CHECKBOX_META_DEFAULT_VALUES,
  FIELD_DROPDOWN_META_DEFAULT_VALUES,
  FIELD_TEXT_META_DEFAULT_VALUES,
  type TEnvelopeFieldAndMeta,
  ZEnvelopeFieldAndMetaSchema,
} from '../../types/field-meta';

type ImportableFormField = SignatureField | TextField | CheckboxField | DropdownField;

type Widget = ReturnType<ImportableFormField['getWidgets']>[number];

export type AcroFormField = TEnvelopeFieldAndMeta & {
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

/**
 * Convert the form fields of a PDF to Documenso fields.
 *
 * A converted form field is removed from the returned PDF. Its value moves to the
 * Documenso field, so the value does not also render on the page below that field.
 * Read-only fields, signed signatures and unsupported types stay in the PDF.
 */
export const extractAcroFormFields = async (pdf: Buffer): Promise<{ cleanedPdf: Buffer; fields: AcroFormField[] }> => {
  const pdfDoc = await PDF.load(pdf);
  const form = pdfDoc.getForm();

  if (!form) {
    return { cleanedPdf: pdf, fields: [] };
  }

  const pages = pdfDoc.getPages();

  const formFields: ImportableFormField[] = [
    ...form.getSignatureFields().filter((formField) => !formField.isSigned()),
    ...form.getTextFields(),
    ...form.getCheckboxes(),
    ...form.getDropdowns(),
  ].filter((formField) => !formField.isReadOnly());

  const fields: AcroFormField[] = [];

  for (const formField of formFields) {
    const widgetFields = formField.getWidgets().flatMap((widget) => {
      const page = pages.find(({ ref }) => ref === widget.pageRef);

      if (!page || widget.isHidden()) {
        return [];
      }

      const position = getFieldPosition(widget.rect, page);

      if (!position) {
        return [];
      }

      return {
        ...ZEnvelopeFieldAndMetaSchema.parse(getFieldAndMeta(formField, widget)),
        ...position,
        page: page.index + 1,
      };
    });

    if (widgetFields.length > 0) {
      fields.push(...widgetFields);
      form.removeField(formField);
    }
  }

  return { cleanedPdf: Buffer.from(await pdfDoc.save()), fields };
};

/**
 * Convert a widget rectangle to a field position.
 *
 * The rectangle is in points from the bottom left of the page before rotation. The
 * position is in percentages from the top left of the page as rendered.
 *
 * Returns null when the widget has no size or is not completely on the page, which
 * is how PDF authors hide a widget.
 */
export const getFieldPosition = (
  [x1, y1, x2, y2]: [number, number, number, number],
  page: Pick<PDFPage, 'width' | 'height' | 'rotation'>,
) => {
  const left = Math.min(x1, x2);
  const right = Math.max(x1, x2);
  const bottom = Math.min(y1, y2);
  const top = Math.max(y1, y2);

  const box = match(page.rotation)
    .with(0, () => ({ x: left, y: page.height - top, width: right - left, height: top - bottom }))
    .with(90, () => ({ x: bottom, y: left, width: top - bottom, height: right - left }))
    .with(180, () => ({ x: page.width - right, y: bottom, width: right - left, height: top - bottom }))
    .with(270, () => ({ x: page.width - top, y: page.height - right, width: top - bottom, height: right - left }))
    .exhaustive();

  const isOnPage =
    box.width > 0 &&
    box.height > 0 &&
    box.x >= 0 &&
    box.y >= 0 &&
    box.x + box.width <= page.width &&
    box.y + box.height <= page.height;

  if (!isOnPage) {
    return null;
  }

  return {
    positionX: (box.x / page.width) * 100,
    positionY: (box.y / page.height) * 100,
    width: (box.width / page.width) * 100,
    height: (box.height / page.height) * 100,
  };
};

const getFieldAndMeta = (formField: ImportableFormField, widget: Widget) => {
  const label = formField.alternateName ?? '';
  const required = formField.isRequired();

  return match(formField)
    .with({ type: 'signature' }, () => ({
      type: FieldType.SIGNATURE,
    }))
    .with({ type: 'text' }, (textField) => ({
      type: FieldType.TEXT,
      fieldMeta: {
        ...FIELD_TEXT_META_DEFAULT_VALUES,
        label,
        required,
        text: textField.getValue(),
      },
    }))
    .with({ type: 'checkbox' }, (checkbox) => {
      const value = widget.getOnValue() ?? checkbox.getOnValue();

      return {
        type: FieldType.CHECKBOX,
        fieldMeta: {
          ...FIELD_CHECKBOX_META_DEFAULT_VALUES,
          label,
          required,
          values: [{ id: 1, checked: checkbox.getValue() === value, value }],
        },
      };
    })
    .with({ type: 'dropdown' }, (dropdown) => ({
      type: FieldType.DROPDOWN,
      fieldMeta: {
        ...FIELD_DROPDOWN_META_DEFAULT_VALUES,
        label,
        required,
        values: dropdown.getOptions().map(({ value }) => ({ value })),
        defaultValue: dropdown.getValue(),
      },
    }))
    .exhaustive();
};
