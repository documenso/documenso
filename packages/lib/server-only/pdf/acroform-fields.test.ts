import fs from 'node:fs';
import path from 'node:path';

import { PDF } from '@libpdf/core';
import { FieldType } from '@prisma/client';
import { beforeAll, describe, expect, it } from 'vitest';

import { convertAcroFormFieldsToFieldInputs, extractAcroFormFieldsFromPDF } from './acroform-fields';

const ASSETS_DIR = path.resolve(__dirname, '../../../../assets');

const loadAsset = (name: string) => fs.readFileSync(path.join(ASSETS_DIR, name));

const buildPdfBuffer = async (rotation: 0 | 90 | 180 | 270 = 0) => {
  const pdf = PDF.create();
  pdf.addPage({ width: 612, height: 792, rotate: rotation });
  pdf.addPage({ width: 612, height: 792, rotate: rotation });

  const form = pdf.getOrCreateForm();
  const [page1, page2] = pdf.getPages();

  const customerName = form.createTextField('CustomerName');
  page1.drawField(customerName, { x: 80, y: 620, width: 200, height: 24 });

  const signedDate = form.createTextField('signed_date');
  page1.drawField(signedDate, { x: 80, y: 560, width: 200, height: 24 });

  const acceptTerms = form.createCheckbox('accept_terms', { onValue: 'Yes' });
  page1.drawField(acceptTerms, { x: 80, y: 500, width: 18, height: 18 });

  const country = form.createDropdown('country', {
    options: ['USA', 'Canada', 'Germany'],
    defaultValue: 'USA',
  });
  page2.drawField(country, { x: 80, y: 700, width: 200, height: 24 });

  const payment = form.createRadioGroup('payment_method', {
    options: ['Credit Card', 'PayPal', 'Bank Transfer'],
    defaultValue: 'PayPal',
  });
  page2.drawField(payment, { x: 80, y: 640, width: 16, height: 16, option: 'Credit Card' });
  page2.drawField(payment, { x: 80, y: 615, width: 16, height: 16, option: 'PayPal' });
  page2.drawField(payment, { x: 80, y: 590, width: 16, height: 16, option: 'Bank Transfer' });

  const initials = form.createTextField('initials');
  page2.drawField(initials, { x: 80, y: 540, width: 60, height: 24 });

  const email = form.createTextField('contact_email');
  page2.drawField(email, { x: 160, y: 540, width: 220, height: 24 });

  const qty = form.createTextField('item_qty', { maxLength: 4 });
  page2.drawField(qty, { x: 400, y: 540, width: 60, height: 24 });

  return Buffer.from(await pdf.save());
};

describe('extractAcroFormFieldsFromPDF', () => {
  let baseBuffer: Buffer;

  beforeAll(async () => {
    baseBuffer = await buildPdfBuffer();
  });

  describe('non-AcroForm input', () => {
    it('returns no-form skip reason for PDFs without an AcroForm', async () => {
      const pdf = PDF.create();
      pdf.addPage({ width: 612, height: 792 });
      const emptyBuffer = Buffer.from(await pdf.save());

      const result = await extractAcroFormFieldsFromPDF(emptyBuffer);

      expect(result.fields).toEqual([]);
      expect(result.unsupported).toEqual([]);
      expect(result.hasSignedSignature).toBe(false);
      expect(result.skipReason).toBe('no-form');
    });

    it('returns error skip reason without throwing for malformed PDFs', async () => {
      const garbage = Buffer.from('not a pdf');

      const result = await extractAcroFormFieldsFromPDF(garbage);

      expect(result.fields).toEqual([]);
      expect(result.skipReason).toBe('error');
    });
  });

  describe('field type resolution', () => {
    it('maps each supported AcroForm field type to its Documenso counterpart', async () => {
      const result = await extractAcroFormFieldsFromPDF(baseBuffer);

      expect(result.skipReason).toBeUndefined();
      expect(result.hasSignedSignature).toBe(false);
      expect(result.unsupported).toEqual([]);

      const byName = new Map(result.fields.map((f) => [f.fieldName, f.fieldAndMeta.type]));

      expect(byName.get('CustomerName')).toBe(FieldType.NAME);
      expect(byName.get('signed_date')).toBe(FieldType.DATE);
      expect(byName.get('accept_terms')).toBe(FieldType.CHECKBOX);
      expect(byName.get('country')).toBe(FieldType.DROPDOWN);
      expect(byName.get('payment_method')).toBe(FieldType.RADIO);
      expect(byName.get('initials')).toBe(FieldType.INITIALS);
      expect(byName.get('contact_email')).toBe(FieldType.EMAIL);
      expect(byName.get('item_qty')).toBe(FieldType.NUMBER);
    });

    it('emits one Documenso RADIO field per widget (one field per option)', async () => {
      const result = await extractAcroFormFieldsFromPDF(baseBuffer);
      const radioFields = result.fields.filter((f) => f.fieldName === 'payment_method');

      expect(radioFields).toHaveLength(3);
      expect(radioFields.every((f) => f.fieldAndMeta.type === FieldType.RADIO)).toBe(true);
    });

    it('stamps source: "acroform" on every imported field meta', async () => {
      const result = await extractAcroFormFieldsFromPDF(baseBuffer);

      expect(result.fields.length).toBeGreaterThan(0);

      for (const f of result.fields) {
        expect(f.fieldAndMeta.fieldMeta?.source).toBe('acroform');
      }
    });

    it('uses partialName as label when no /TU is set', async () => {
      const result = await extractAcroFormFieldsFromPDF(baseBuffer);
      const nameField = result.fields.find((f) => f.fieldName === 'CustomerName');

      expect(nameField).toBeDefined();
      expect(nameField?.fieldAndMeta.fieldMeta?.label).toBe('CustomerName');
    });
  });

  describe('default values', () => {
    it('copies AcroForm dropdown default into fieldMeta.defaultValue when formValues was not provided', async () => {
      const result = await extractAcroFormFieldsFromPDF(baseBuffer);
      const country = result.fields.find((f) => f.fieldName === 'country');

      expect(country?.fieldAndMeta.type).toBe(FieldType.DROPDOWN);
      if (country?.fieldAndMeta.type === FieldType.DROPDOWN) {
        expect(country.fieldAndMeta.fieldMeta?.defaultValue).toBe('USA');
        expect(country.fieldAndMeta.fieldMeta?.values?.map((v) => v.value)).toEqual(['USA', 'Canada', 'Germany']);
      }
    });

    it('skips AcroForm defaults when formValuesProvided is true', async () => {
      const result = await extractAcroFormFieldsFromPDF(baseBuffer, { formValuesProvided: true });
      const country = result.fields.find((f) => f.fieldName === 'country');

      expect(country?.fieldAndMeta.type).toBe(FieldType.DROPDOWN);
      if (country?.fieldAndMeta.type === FieldType.DROPDOWN) {
        expect(country.fieldAndMeta.fieldMeta?.defaultValue).toBe('');
      }
    });

    it('marks the default radio option as checked when formValues was not provided', async () => {
      const result = await extractAcroFormFieldsFromPDF(baseBuffer);
      const radios = result.fields.filter((f) => f.fieldName === 'payment_method');
      const checkedValues = radios.flatMap((r) => {
        if (r.fieldAndMeta.type !== FieldType.RADIO) {
          return [];
        }

        return (r.fieldAndMeta.fieldMeta?.values ?? []).filter((v) => v.checked).map((v) => v.value);
      });

      expect(checkedValues).toContain('PayPal');
    });
  });

  describe('geometry', () => {
    it('produces percentages relative to rendered page dimensions for non-rotated pages', async () => {
      const result = await extractAcroFormFieldsFromPDF(baseBuffer);
      const customerName = result.fields.find((f) => f.fieldName === 'CustomerName');

      expect(customerName).toBeDefined();

      if (customerName) {
        // user (80, 620) with width 200, height 24 on a 612x792 page.
        // Rendered top-left: (80, 792 - 620 - 24) = (80, 148).
        const xPct = (customerName.x / customerName.pageWidth) * 100;
        const yPct = (customerName.y / customerName.pageHeight) * 100;
        const wPct = (customerName.width / customerName.pageWidth) * 100;
        const hPct = (customerName.height / customerName.pageHeight) * 100;

        expect(xPct).toBeCloseTo((80 / 612) * 100, 2);
        expect(yPct).toBeCloseTo((148 / 792) * 100, 2);
        expect(wPct).toBeCloseTo((200 / 612) * 100, 2);
        expect(hPct).toBeCloseTo((24 / 792) * 100, 2);
      }
    });

    it('handles 90-degree rotated pages with the inverse rotation transform', async () => {
      const rotated = await buildPdfBuffer(90);
      const result = await extractAcroFormFieldsFromPDF(rotated);
      const customerName = result.fields.find((f) => f.fieldName === 'CustomerName');

      expect(customerName).toBeDefined();

      if (customerName) {
        // Rendered page dims for /Rotate 90: width = mediaH (792), height = mediaW (612).
        expect(customerName.pageWidth).toBeCloseTo(792, 0);
        expect(customerName.pageHeight).toBeCloseTo(612, 0);

        // R=90 transform: renderedX = yB = 620, renderedY = xL = 80.
        const xPct = (customerName.x / customerName.pageWidth) * 100;
        const yPct = (customerName.y / customerName.pageHeight) * 100;

        expect(xPct).toBeCloseTo((620 / 792) * 100, 2);
        expect(yPct).toBeCloseTo((80 / 612) * 100, 2);
      }
    });

    it('handles 180-degree rotated pages', async () => {
      const rotated = await buildPdfBuffer(180);
      const result = await extractAcroFormFieldsFromPDF(rotated);
      const customerName = result.fields.find((f) => f.fieldName === 'CustomerName');

      expect(customerName).toBeDefined();

      if (customerName) {
        // R=180: renderedX = mediaW - xR = 612 - 280 = 332. renderedY = yB = 620.
        const xPct = (customerName.x / customerName.pageWidth) * 100;
        const yPct = (customerName.y / customerName.pageHeight) * 100;

        expect(xPct).toBeCloseTo((332 / 612) * 100, 2);
        expect(yPct).toBeCloseTo((620 / 792) * 100, 2);
      }
    });

    it('handles 270-degree rotated pages', async () => {
      const rotated = await buildPdfBuffer(270);
      const result = await extractAcroFormFieldsFromPDF(rotated);
      const customerName = result.fields.find((f) => f.fieldName === 'CustomerName');

      expect(customerName).toBeDefined();

      if (customerName) {
        // R=270 page dims swap: pageW = mediaH = 792, pageH = mediaW = 612.
        // renderedX = mediaH - yT = 792 - 644 = 148. renderedY = mediaW - xR = 612 - 280 = 332.
        const xPct = (customerName.x / customerName.pageWidth) * 100;
        const yPct = (customerName.y / customerName.pageHeight) * 100;

        expect(xPct).toBeCloseTo((148 / 792) * 100, 2);
        expect(yPct).toBeCloseTo((332 / 612) * 100, 2);
      }
    });
  });
});

describe('convertAcroFormFieldsToFieldInputs', () => {
  it('sorts by (page, y, x) before mapping recipients', async () => {
    const buffer = await buildPdfBuffer();
    const { fields } = await extractAcroFormFieldsFromPDF(buffer);

    const recipient = { id: 42 };
    const inputs = convertAcroFormFieldsToFieldInputs(fields, () => recipient, 'env_item_1');

    expect(inputs).toHaveLength(fields.length);

    // Sorted by page first.
    const pages = inputs.map((i) => i.page);
    const sortedPages = [...pages].sort((a, b) => a - b);
    expect(pages).toEqual(sortedPages);

    // Within a single page, positionY (top-left coords) should be ascending
    // when rows are >2% apart.
    for (let i = 1; i < inputs.length; i++) {
      const prev = inputs[i - 1];
      const curr = inputs[i];

      if (prev.page !== curr.page) {
        continue;
      }

      const yDelta = curr.positionY - prev.positionY;
      // Either next row (yDelta > -2%) or same row (then x must be ascending).
      if (Math.abs(yDelta) <= 2) {
        expect(curr.positionX).toBeGreaterThanOrEqual(prev.positionX);
      } else {
        expect(yDelta).toBeGreaterThan(0);
      }
    }
  });

  it('passes recipientId through the resolver for every imported field', async () => {
    const buffer = await buildPdfBuffer();
    const { fields } = await extractAcroFormFieldsFromPDF(buffer);

    const recipient = { id: 7 };
    const inputs = convertAcroFormFieldsToFieldInputs(fields, () => recipient, 'env_item_xyz');

    for (const input of inputs) {
      expect(input.recipientId).toBe(recipient.id);
      expect(input.envelopeItemId).toBe('env_item_xyz');
    }
  });
});

describe('extractAcroFormFieldsFromPDF — committed fixture', () => {
  it('extracts the expected fields from assets/acroform-import-test.pdf', async () => {
    const buffer = loadAsset('acroform-import-test.pdf');
    const result = await extractAcroFormFieldsFromPDF(buffer);

    expect(result.skipReason).toBeUndefined();
    expect(result.unsupported).toEqual([]);
    expect(result.fields.length).toBeGreaterThanOrEqual(8);
  });

  it('extracts the expected fields from rotated fixtures (90/180/270)', async () => {
    for (const angle of [90, 180, 270]) {
      const buffer = loadAsset(`acroform-import-rotated-${angle}.pdf`);
      const result = await extractAcroFormFieldsFromPDF(buffer);

      expect(result.skipReason).toBeUndefined();
      expect(result.unsupported).toEqual([]);
      expect(result.fields.length).toBeGreaterThanOrEqual(8);
    }
  });
});
