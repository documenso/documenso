import { PDF, PdfArray, PdfDict, PdfName, PdfNumber, PdfString } from '@libpdf/core';
import { FieldType } from '@prisma/client';
import { describe, expect, it } from 'vitest';

import { extractAcroFormFields, getFieldPosition } from './acroform-fields';
import { normalizePdf } from './normalize-pdf';

const READ_ONLY_FLAG = 1;
const REQUIRED_FLAG = 2;

const createFormPdf = async () => {
  const pdf = PDF.create();
  const page = pdf.addPage({ width: 600, height: 800 });
  const form = pdf.getOrCreateForm();

  const signature = form.createSignatureField('signature');

  signature.addWidget(
    PdfDict.of({
      Subtype: PdfName.of('Widget'),
      Rect: PdfArray.of(PdfNumber.of(60), PdfNumber.of(400), PdfNumber.of(300), PdfNumber.of(480)),
      P: page.ref,
    }),
  );

  const fullName = form.createTextField('full_name', { defaultValue: 'Jane Doe' });

  fullName.acroField().set('TU', PdfString.fromString('Full name'));
  page.drawField(fullName, { x: 60, y: 700, width: 240, height: 20 });

  const reference = form.createTextField('reference', { defaultValue: 'REF-001' });

  reference.acroField().set('Ff', PdfNumber.of(READ_ONLY_FLAG));
  page.drawField(reference, { x: 60, y: 650, width: 240, height: 20 });

  const acceptTerms = form.createCheckbox('accept_terms', { onValue: 'Yes', defaultChecked: true });

  acceptTerms.acroField().set('Ff', PdfNumber.of(REQUIRED_FLAG));
  page.drawField(acceptTerms, { x: 60, y: 600, width: 20, height: 20 });

  page.drawField(form.createDropdown('country', { options: ['Ghana', 'Kenya'], defaultValue: 'Kenya' }), {
    x: 60,
    y: 550,
    width: 240,
    height: 20,
  });

  return Buffer.from(await pdf.save());
};

describe('extractAcroFormFields', () => {
  it('converts the form fields and moves their values out of the PDF', async () => {
    const { cleanedPdf, fields } = await extractAcroFormFields(await createFormPdf());

    const [signature, text, checkbox, dropdown] = fields;

    expect(fields).toHaveLength(4);
    expect(signature).toMatchObject({
      type: FieldType.SIGNATURE,
      page: 1,
      positionX: 10,
      positionY: 40,
      width: 40,
      height: 10,
    });
    expect(text).toMatchObject({
      type: FieldType.TEXT,
      fieldMeta: { label: 'Full name', text: 'Jane Doe', required: false },
    });
    expect(checkbox).toMatchObject({
      type: FieldType.CHECKBOX,
      fieldMeta: { required: true, values: [{ id: 1, checked: true, value: 'Yes' }] },
    });
    expect(dropdown).toMatchObject({
      type: FieldType.DROPDOWN,
      fieldMeta: { values: [{ value: 'Ghana' }, { value: 'Kenya' }], defaultValue: 'Kenya' },
    });

    // Only the read-only field stays, and only its value is drawn when the PDF is flattened.
    const cleaned = await PDF.load(cleanedPdf);

    expect(cleaned.getForm()?.getFieldNames()).toEqual(['reference']);

    const flattened = await PDF.load((await normalizePdf(cleanedPdf)).pdf);

    expect(flattened.findText('REF-001')).toHaveLength(1);
    expect(flattened.findText('Jane Doe')).toHaveLength(0);
    expect(flattened.findText('Kenya')).toHaveLength(0);
  });
});

describe('getFieldPosition', () => {
  // 100 points from the left and 50 points from the bottom of a 600 x 800 page, 300 x 40 points in size.
  const rect: [number, number, number, number] = [100, 50, 400, 90];

  it.each([
    { rotation: 0, width: 600, height: 800, expected: [16.667, 88.75, 50, 5] },
    { rotation: 90, width: 800, height: 600, expected: [6.25, 16.667, 5, 50] },
    { rotation: 180, width: 600, height: 800, expected: [33.333, 6.25, 50, 5] },
    { rotation: 270, width: 800, height: 600, expected: [88.75, 33.333, 5, 50] },
  ] as const)('follows a page rotation of $rotation degrees', ({ expected, ...page }) => {
    const position = getFieldPosition(rect, page);

    expect(position?.positionX).toBeCloseTo(expected[0]);
    expect(position?.positionY).toBeCloseTo(expected[1]);
    expect(position?.width).toBeCloseTo(expected[2]);
    expect(position?.height).toBeCloseTo(expected[3]);
  });

  it.each([
    { reason: 'has no size', hiddenRect: [100, 50, 100, 50] },
    { reason: 'is off the page', hiddenRect: [-200, 50, -100, 90] },
  ] as const)('skips a widget that $reason', ({ hiddenRect }) => {
    expect(getFieldPosition([...hiddenRect], { rotation: 0, width: 600, height: 800 })).toBeNull();
  });
});
