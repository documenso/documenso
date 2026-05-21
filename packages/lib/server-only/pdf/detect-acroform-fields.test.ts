import { PDF, StandardFonts } from '@libpdf/core';
import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import {
  detectAcroFormFields,
  mapAcroFormFieldType,
  widgetRectToPercentages,
} from './detect-acroform-fields';

/**
 * Build a two-page form: `textFieldsPerPage` text fields on each page plus one
 * checkbox on page two. When `stripPageRef` is set, the optional `/P` entry is
 * removed from every widget annotation to mimic the many real-world forms
 * (e.g. Acrobat-generated government forms) that omit it.
 */
const buildMultiFieldForm = async ({
  textFieldsPerPage = 5,
  stripPageRef = false,
}: { textFieldsPerPage?: number; stripPageRef?: boolean } = {}): Promise<Buffer> => {
  const pdf = await PDF.create();
  const form = pdf.getOrCreateForm();

  const pages = [pdf.addPage(), pdf.addPage()];

  pages.forEach((page, pageIndex) => {
    page.drawText('Peninsula School District', {
      x: 50,
      y: 740,
      size: 16,
      font: StandardFonts.Helvetica,
    });

    for (let i = 0; i < textFieldsPerPage; i++) {
      const field = form.createTextField(`p${pageIndex}_text_${i}`, { fontSize: 10 });
      page.drawField(field, { x: 330, y: 680 - i * 30, width: 200, height: 16 });
    }
  });

  const checkbox = form.createCheckbox('agree', { onValue: 'Yes' });
  pages[1].drawField(checkbox, { x: 60, y: 120, width: 14, height: 14 });

  let buffer = Buffer.from(await pdf.save());

  if (stripPageRef) {
    const reopened = await PDF.load(new Uint8Array(buffer));
    const reopenedForm = reopened.getForm();

    for (const field of reopenedForm?.getFields() ?? []) {
      for (const widget of field.getWidgets()) {
        widget.dict.delete('P');
      }
    }

    buffer = Buffer.from(await reopened.save());
  }

  return buffer;
};

describe('mapAcroFormFieldType', () => {
  it('maps known AcroForm field types to Documenso field types', () => {
    expect(mapAcroFormFieldType('text')).toBe(FieldType.TEXT);
    expect(mapAcroFormFieldType('checkbox')).toBe(FieldType.CHECKBOX);
    expect(mapAcroFormFieldType('radio')).toBe(FieldType.RADIO);
    expect(mapAcroFormFieldType('dropdown')).toBe(FieldType.DROPDOWN);
    expect(mapAcroFormFieldType('listbox')).toBe(FieldType.DROPDOWN);
    expect(mapAcroFormFieldType('signature')).toBe(FieldType.SIGNATURE);
  });

  it('returns null for unsupported field types', () => {
    expect(mapAcroFormFieldType('button')).toBeNull();
    expect(mapAcroFormFieldType('unknown')).toBeNull();
    expect(mapAcroFormFieldType('non-terminal')).toBeNull();
  });
});

describe('widgetRectToPercentages', () => {
  const pageWidth = 200;
  const pageHeight = 400;

  it('converts a bottom-left-origin rect into top-left percentages', () => {
    // A 20x40 widget whose bottom-left corner is at (20, 320) in PDF space.
    const result = widgetRectToPercentages([20, 320, 40, 360], pageWidth, pageHeight);

    expect(result.positionX).toBeCloseTo(10);
    // top = 400 - 320 - 40 = 40 -> 40 / 400 = 10%
    expect(result.positionY).toBeCloseTo(10);
    expect(result.width).toBeCloseTo(10);
    expect(result.height).toBeCloseTo(10);
  });

  it('normalizes rects given with reversed corners', () => {
    const result = widgetRectToPercentages([40, 360, 20, 320], pageWidth, pageHeight);

    expect(result.positionX).toBeCloseTo(10);
    expect(result.positionY).toBeCloseTo(10);
    expect(result.width).toBeCloseTo(10);
    expect(result.height).toBeCloseTo(10);
  });

  it('falls back to default dimensions for degenerate rects', () => {
    const result = widgetRectToPercentages([10, 200, 10, 200], pageWidth, pageHeight);

    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('clamps positions and sizes to stay within the page', () => {
    const result = widgetRectToPercentages([180, 0, 260, 80], pageWidth, pageHeight);

    expect(result.positionX).toBeGreaterThanOrEqual(0);
    expect(result.positionX).toBeLessThanOrEqual(100);
    expect(result.positionX + result.width).toBeLessThanOrEqual(100.0001);
    expect(result.positionY + result.height).toBeLessThanOrEqual(100.0001);
  });
});

describe('detectAcroFormFields', () => {
  it('detects every field on a multi-field, multi-page form', async () => {
    // 5 text fields per page across 2 pages + 1 checkbox = 11 fields.
    const pdf = await buildMultiFieldForm({ textFieldsPerPage: 5 });

    const detected = await detectAcroFormFields(pdf);

    expect(detected).toHaveLength(11);
    expect(detected.filter((f) => f.type === FieldType.TEXT)).toHaveLength(10);
    expect(detected.filter((f) => f.type === FieldType.CHECKBOX)).toHaveLength(1);
    expect(detected.filter((f) => f.page === 1)).toHaveLength(5);
    expect(detected.filter((f) => f.page === 2)).toHaveLength(6);
  });

  it('detects all fields even when widgets omit the optional /P page entry', async () => {
    // Regression for #28: forms whose widgets lack /P previously had every
    // such widget dropped, so detection reported far fewer fields than exist.
    const pdf = await buildMultiFieldForm({ textFieldsPerPage: 5, stripPageRef: true });

    const detected = await detectAcroFormFields(pdf);

    expect(detected).toHaveLength(11);
    expect(detected.filter((f) => f.page === 1)).toHaveLength(5);
    expect(detected.filter((f) => f.page === 2)).toHaveLength(6);
  });

  it('returns an empty array for a PDF without a form', async () => {
    const pdf = await PDF.create();
    pdf.addPage();

    const detected = await detectAcroFormFields(Buffer.from(await pdf.save()));

    expect(detected).toEqual([]);
  });
});
