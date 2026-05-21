import fs from 'node:fs';
import path from 'node:path';

import { AnnotationFlags, PDF, PdfDict, PdfName, PdfNumber, PdfString } from '@libpdf/core';
import { FieldType } from '@prisma/client';
import { beforeAll, describe, expect, it, vi } from 'vitest';

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

  // Format-action precedence: name matches /name/i (would resolve to NAME) but
  // AcroForm carries an `AFNumber_Format` action — the action MUST win.
  const customerNameNumberField = form.createTextField('customer_name_amount');
  page2.drawField(customerNameNumberField, { x: 80, y: 480, width: 120, height: 24 });
  customerNameNumberField.acroField().set(
    'AA',
    PdfDict.of({
      F: PdfDict.of({
        S: PdfName.of('JavaScript'),
        JS: PdfString.fromString('AFNumber_Format(2, 0, 0, 0, "$", true)'),
      }),
    }),
  );

  // Required CHECKBOX: /Ff bit 2 (REQUIRED) set via raw dict.
  const requiredTerms = form.createCheckbox('required_terms', { onValue: 'Accepted' });
  page2.drawField(requiredTerms, { x: 220, y: 480, width: 18, height: 18 });
  requiredTerms.acroField().set('Ff', PdfNumber.of(2));

  // /TU (alternateName) label fallback: partialName is `shipping_addr` but
  // /TU carries a human label that MUST be preferred over partialName.
  const shippingAddress = form.createTextField('shipping_addr');
  page2.drawField(shippingAddress, { x: 280, y: 480, width: 220, height: 24 });
  shippingAddress.acroField().set('TU', PdfString.fromString('Shipping address'));

  // Hidden widget: should land in `unsupported` with reason 'hidden' rather
  // than producing a field. WidgetAnnotation has no public setFlag, so we
  // write the annotation /F entry directly (bit 2 = Hidden).
  const hiddenField = form.createTextField('hidden_field');
  page2.drawField(hiddenField, { x: 80, y: 440, width: 100, height: 20 });
  const hiddenWidgets = hiddenField.getWidgets() as Array<{ dict: PdfDict }>;
  if (hiddenWidgets[0]) {
    hiddenWidgets[0].dict.set('F', PdfNumber.of(AnnotationFlags.Hidden));
  }

  // Off-page widget: positioned beyond the right edge of a 612pt-wide page so
  // the extractor reports `off-page`. Drawn AFTER all others so the file is
  // intentionally malformed.
  const offPageField = form.createTextField('off_page_field');
  page2.drawField(offPageField, { x: 700, y: 440, width: 60, height: 20 });

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
      // Two intentionally-bad widgets in the fixture: hidden and off-page.
      expect(result.unsupported.map((u) => u.reason).sort()).toEqual(['hidden', 'off-page']);

      const byName = new Map(result.fields.map((f) => [f.fieldName, f.fieldAndMeta.type]));

      expect(byName.get('CustomerName')).toBe(FieldType.NAME);
      expect(byName.get('signed_date')).toBe(FieldType.DATE);
      expect(byName.get('accept_terms')).toBe(FieldType.CHECKBOX);
      expect(byName.get('country')).toBe(FieldType.DROPDOWN);
      expect(byName.get('payment_method')).toBe(FieldType.RADIO);
      expect(byName.get('initials')).toBe(FieldType.INITIALS);
      expect(byName.get('contact_email')).toBe(FieldType.EMAIL);
      expect(byName.get('item_qty')).toBe(FieldType.NUMBER);
      // Hidden and off-page widgets must not appear as fields.
      expect(byName.has('hidden_field')).toBe(false);
      expect(byName.has('off_page_field')).toBe(false);
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

    it('prefers AcroForm /TU (alternateName) over partialName for the label', async () => {
      const result = await extractAcroFormFieldsFromPDF(baseBuffer);
      const shippingField = result.fields.find((f) => f.fieldName === 'shipping_addr');

      expect(shippingField).toBeDefined();
      expect(shippingField?.fieldAndMeta.fieldMeta?.label).toBe('Shipping address');
    });

    it('lets AcroForm format actions override the name heuristic (P1.1)', async () => {
      const result = await extractAcroFormFieldsFromPDF(baseBuffer);
      const numberField = result.fields.find((f) => f.fieldName === 'customer_name_amount');

      // Without the format action, /name/i would steer this to NAME. The
      // `AFNumber_Format` action MUST win.
      expect(numberField?.fieldAndMeta.type).toBe(FieldType.NUMBER);
    });

    it('maps required CHECKBOX (/Ff bit 2) to validationRule "at-least" + length 1', async () => {
      const result = await extractAcroFormFieldsFromPDF(baseBuffer);
      const required = result.fields.find((f) => f.fieldName === 'required_terms');

      expect(required?.fieldAndMeta.type).toBe(FieldType.CHECKBOX);
      if (required?.fieldAndMeta.type === FieldType.CHECKBOX) {
        expect(required.fieldAndMeta.fieldMeta?.required).toBe(true);
        expect(required.fieldAndMeta.fieldMeta?.validationRule).toBe('at-least');
        expect(required.fieldAndMeta.fieldMeta?.validationLength).toBe(1);
      }
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

/**
 * Stub-based scenarios exercise paths that {@link buildPdfBuffer} cannot easily
 * produce (signed signatures, encrypted docs, XFA hybrids, listboxes, widgets
 * with mismatched page refs). Each stub mirrors the methods the extractor
 * actually calls — keeping the contract narrow so a future refactor of the
 * extractor surfaces here as a loud test failure rather than a silent miss.
 */
describe('extractAcroFormFieldsFromPDF — mocked scenarios', () => {
  const emptyAcroFormDict = { has: () => false };
  const emptyCatalogDict = {
    getDict: () => emptyAcroFormDict,
  };
  const emptyContext = {
    catalog: { getDict: () => emptyCatalogDict },
    resolve: () => null,
  };

  const buildFieldStub = (overrides: Record<string, unknown>) => ({
    name: 'stub_field',
    partialName: 'stub_field',
    alternateName: null,
    isReadOnly: () => false,
    isRequired: () => false,
    acroField: () => ({
      get: () => undefined,
      getDict: () => undefined,
      getNumber: () => undefined,
      has: () => false,
      set: () => undefined,
    }),
    getWidgets: () => [],
    ...overrides,
  });

  it('returns skipReason "encrypted" when PDF.isEncrypted is true (P2.6)', async () => {
    vi.spyOn(PDF, 'load').mockResolvedValueOnce({ isEncrypted: true } as unknown as PDF);

    const result = await extractAcroFormFieldsFromPDF(Buffer.from('stub'));

    expect(result.skipReason).toBe('encrypted');
    expect(result.fields).toEqual([]);
    expect(result.hasSignedSignature).toBe(false);
  });

  it('returns skipReason "xfa-hybrid" when /AcroForm has /XFA (P2.1)', async () => {
    const xfaCatalogDict = {
      getDict: (key: string) => (key === 'AcroForm' ? { has: (k: string) => k === 'XFA' } : undefined),
    };

    vi.spyOn(PDF, 'load').mockResolvedValueOnce({
      isEncrypted: false,
      context: { catalog: { getDict: () => xfaCatalogDict }, resolve: () => null },
      getForm: () => ({ getFields: () => [] }),
      getPages: () => [],
    } as unknown as PDF);

    const result = await extractAcroFormFieldsFromPDF(Buffer.from('stub'));

    expect(result.skipReason).toBe('xfa-hybrid');
    expect(result.fields).toEqual([]);
  });

  it('skips signed signature widgets and reports hasSignedSignature: true (P1.2)', async () => {
    const signedField = buildFieldStub({
      type: 'signature',
      name: 'ExistingSignature',
      partialName: 'ExistingSignature',
      isSigned: () => true,
    });

    vi.spyOn(PDF, 'load').mockResolvedValueOnce({
      isEncrypted: false,
      context: emptyContext,
      getForm: () => ({ getFields: () => [signedField] }),
      getPages: () => [],
    } as unknown as PDF);

    const result = await extractAcroFormFieldsFromPDF(Buffer.from('stub'));

    expect(result.hasSignedSignature).toBe(true);
    expect(result.fields).toEqual([]);
    expect(result.unsupported.find((u) => u.reason === 'signed-signature')).toMatchObject({
      fieldName: 'ExistingSignature',
      acroFormType: 'signature',
    });
  });

  it('imports unsigned signature widgets normally (P1.2 negative control)', async () => {
    const pageRef = { objectNumber: 1, generation: 0 } as unknown as PdfDict;
    const widget = {
      rect: [100, 600, 300, 640] as [number, number, number, number],
      pageRef,
      isHidden: () => false,
      getOnValue: () => null,
    };
    const unsignedField = buildFieldStub({
      type: 'signature',
      name: 'NewSignature',
      partialName: 'NewSignature',
      isSigned: () => false,
      getWidgets: () => [widget],
    });
    const page = {
      ref: pageRef,
      width: 612,
      height: 792,
      rotation: 0,
      getMediaBox: () => ({ x: 0, y: 0, width: 612, height: 792 }),
    };

    vi.spyOn(PDF, 'load').mockResolvedValueOnce({
      isEncrypted: false,
      context: emptyContext,
      getForm: () => ({ getFields: () => [unsignedField] }),
      getPages: () => [page],
    } as unknown as PDF);

    const result = await extractAcroFormFieldsFromPDF(Buffer.from('stub'));

    expect(result.hasSignedSignature).toBe(false);
    expect(result.fields).toHaveLength(1);
    expect(result.fields[0]?.fieldAndMeta.type).toBe(FieldType.SIGNATURE);
  });

  it('reports listbox fields as unsupported-type (P2.6)', async () => {
    const listboxField = buildFieldStub({
      type: 'listbox',
      name: 'colors',
      partialName: 'colors',
    });

    vi.spyOn(PDF, 'load').mockResolvedValueOnce({
      isEncrypted: false,
      context: emptyContext,
      getForm: () => ({ getFields: () => [listboxField] }),
      getPages: () => [],
    } as unknown as PDF);

    const result = await extractAcroFormFieldsFromPDF(Buffer.from('stub'));

    expect(result.fields).toEqual([]);
    expect(result.unsupported).toHaveLength(1);
    expect(result.unsupported[0]?.reason).toBe('unsupported-type');
    expect(result.unsupported[0]?.acroFormType).toBe('listbox');
  });

  it('reports widgets with unknown pageRef as no-page-match (P2.6)', async () => {
    const realPageRef = { objectNumber: 1, generation: 0 } as unknown as PdfDict;
    const orphanPageRef = { objectNumber: 99, generation: 0 } as unknown as PdfDict;
    const orphanField = buildFieldStub({
      type: 'text',
      name: 'orphan_text',
      partialName: 'orphan_text',
      getWidgets: () => [
        {
          rect: [100, 600, 200, 620] as [number, number, number, number],
          pageRef: orphanPageRef,
          isHidden: () => false,
          getOnValue: () => null,
        },
      ],
    });
    const page = {
      ref: realPageRef,
      width: 612,
      height: 792,
      rotation: 0,
      getMediaBox: () => ({ x: 0, y: 0, width: 612, height: 792 }),
    };

    vi.spyOn(PDF, 'load').mockResolvedValueOnce({
      isEncrypted: false,
      context: emptyContext,
      getForm: () => ({ getFields: () => [orphanField] }),
      getPages: () => [page],
    } as unknown as PDF);

    const result = await extractAcroFormFieldsFromPDF(Buffer.from('stub'));

    expect(result.fields).toEqual([]);
    expect(result.unsupported.map((u) => u.reason)).toContain('no-page-match');
  });
});
