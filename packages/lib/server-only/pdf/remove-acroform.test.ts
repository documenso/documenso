// ABOUTME: Tests that removeAcroForm strips all interactive form fields from PDFs before signing.
// ABOUTME: Uses real @libpdf/core operations on generated PDFs — no mocks.

import { describe, expect, it } from 'vitest';

import { PDF } from '@libpdf/core';

describe('removeAcroForm', () => {
  it('should remove all AcroForm fields including those flattenAll misses', async () => {
    const pdf = PDF.create();
    pdf.addPage({ width: 200, height: 200 });

    const form = pdf.getOrCreateForm();

    form.createTextField('TestField1', {
      page: 0,
      rect: { x: 10, y: 150, width: 180, height: 20 },
      value: 'editable text',
    });

    form.createTextField('TestField2', {
      page: 0,
      rect: { x: 10, y: 120, width: 180, height: 20 },
      value: 'another field',
    });

    const savedBytes = await pdf.save();
    const reloaded = await PDF.load(savedBytes);

    const formBefore = reloaded.getForm();
    expect(formBefore).not.toBeNull();
    expect(formBefore!.getFields().length).toBe(2);

    reloaded.flattenAll();
    reloaded.context.catalog.removeAcroForm();

    const cleanBytes = await reloaded.save({ useXRefStream: true });
    const final = await PDF.load(cleanBytes);

    expect(final.getForm()).toBeNull();
    expect(final.getPageCount()).toBe(1);
  });

  it('should be a no-op when PDF has no AcroForm', async () => {
    const pdf = PDF.create();
    pdf.addPage({ width: 200, height: 200 });

    const savedBytes = await pdf.save();
    const reloaded = await PDF.load(savedBytes);

    expect(reloaded.getForm()).toBeNull();

    reloaded.context.catalog.removeAcroForm();

    const cleanBytes = await reloaded.save({ useXRefStream: true });
    const final = await PDF.load(cleanBytes);

    expect(final.getForm()).toBeNull();
    expect(final.getPageCount()).toBe(1);
  });
});
