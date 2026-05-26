import { PDF, StandardFonts } from '@libpdf/core';
import { FieldType } from '@prisma/client';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import {
  detectAcroFormFields,
  mapAcroFormFieldType,
  widgetRectToPercentages,
} from './detect-acroform-fields';

/**
 * Real-world AcroForm fixture: a blank Pennsylvania government form whose 98
 * widgets reference their page in a way `@libpdf/core` cannot reconcile, so
 * neither the `/P` nor the `/Annots` lookup resolves any of them (regression
 * for #30). Lives next to this test so it ships with the automated suite.
 */
const PA_FORM_PATH = fileURLToPath(new URL('./__fixtures__/blank-pa-form.pdf', import.meta.url));

/**
 * Strip both the widget -> page (`/P`) and page -> widget (`/Annots`) links so
 * neither reference lookup in `resolveWidgetPage` can resolve a page, forcing
 * the bounds-based fallback. Mimics the PA government forms.
 */
const stripPageLinks = async (buffer: Buffer): Promise<Buffer> => {
  const reopened = await PDF.load(new Uint8Array(buffer));

  for (const field of reopened.getForm()?.getFields() ?? []) {
    for (const widget of field.getWidgets()) {
      widget.dict.delete('P');
    }
  }

  for (const page of reopened.getPages()) {
    page.dict.delete('Annots');
  }

  return Buffer.from(await reopened.save());
};

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

  it('detects fields on a single-page form when neither /P nor /Annots resolves', async () => {
    // Regression for #30: when both the widget -> page and page -> widget links
    // are unresolvable, every field used to be dropped. A single-page document
    // must fall back to page 0 instead of losing the whole form.
    const single = await PDF.create();
    const form = single.getOrCreateForm();
    const page = single.addPage();

    for (let i = 0; i < 6; i++) {
      const field = form.createTextField(`text_${i}`, { fontSize: 10 });
      page.drawField(field, { x: 100, y: 700 - i * 30, width: 200, height: 16 });
    }

    const pdf = await stripPageLinks(Buffer.from(await single.save()));

    const detected = await detectAcroFormFields(pdf);

    expect(detected).toHaveLength(6);
    expect(detected.every((f) => f.page === 1)).toBe(true);
  });

  it('assigns widgets to the page whose bounds contain them when refs are unresolvable', async () => {
    // Regression for #30 (multi-page): with both links stripped, fall back to
    // the page whose media box contains the widget rectangle.
    const pdf = await PDF.create();
    const form = pdf.getOrCreateForm();
    const small = pdf.addPage({ width: 300, height: 300 });
    const large = pdf.addPage({ width: 600, height: 800 });

    // Fits both pages -> resolves to the first page (index 0).
    const onSmall = form.createTextField('on_small', { fontSize: 10 });
    small.drawField(onSmall, { x: 50, y: 50, width: 100, height: 16 });

    // Beyond the small page's bounds -> only the large page contains it.
    const onLarge = form.createTextField('on_large', { fontSize: 10 });
    large.drawField(onLarge, { x: 400, y: 700, width: 150, height: 16 });

    const stripped = await stripPageLinks(Buffer.from(await pdf.save()));

    const detected = await detectAcroFormFields(stripped);

    expect(detected).toHaveLength(2);
    expect(detected.find((f) => f.name === 'on_small')?.page).toBe(1);
    expect(detected.find((f) => f.name === 'on_large')?.page).toBe(2);
  });

  it('detects 90+ fields on the real PA government form (issue #30)', async () => {
    const pdf = readFileSync(PA_FORM_PATH);

    const detected = await detectAcroFormFields(pdf);

    // The form contains 98 supported fields. Assert the documented floor.
    expect(detected.length).toBeGreaterThanOrEqual(90);
    // Single-page form: every field must be assigned to page 1.
    expect(detected.every((f) => f.page === 1)).toBe(true);
    // Every field must carry a usable position within the page.
    expect(
      detected.every(
        (f) =>
          f.positionX >= 0 &&
          f.positionX <= 100 &&
          f.positionY >= 0 &&
          f.positionY <= 100 &&
          f.width > 0 &&
          f.height > 0,
      ),
    ).toBe(true);
  });

  it('returns an empty array for a PDF without a form', async () => {
    const pdf = await PDF.create();
    pdf.addPage();

    const detected = await detectAcroFormFields(Buffer.from(await pdf.save()));

    expect(detected).toEqual([]);
  });
});
