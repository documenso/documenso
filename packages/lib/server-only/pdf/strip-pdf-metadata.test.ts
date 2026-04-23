import { PDFDocument, PDFName } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';

import { stripPdfMetadata } from './strip-pdf-metadata';

const makeDocWithMetadata = async () => {
  const doc = await PDFDocument.create();
  doc.addPage([612, 792]);
  doc.setTitle('Secret title');
  doc.setAuthor('Secret author');
  doc.setSubject('Secret subject');
  doc.setKeywords(['secret', 'keyword']);
  doc.setCreator('Secret creator');
  doc.setProducer('Secret producer');
  return new Uint8Array(await doc.save());
};

describe('stripPdfMetadata', () => {
  it('removes Title, Author, Subject, Keywords, Creator, Producer', async () => {
    const input = await makeDocWithMetadata();

    const output = await stripPdfMetadata(input);

    const parsed = await PDFDocument.load(output, { updateMetadata: false });
    expect(parsed.getTitle() ?? '').toBe('');
    expect(parsed.getAuthor() ?? '').toBe('');
    expect(parsed.getSubject() ?? '').toBe('');
    expect(parsed.getKeywords() ?? '').toBe('');
    expect(parsed.getCreator() ?? '').toBe('');
    expect(parsed.getProducer() ?? '').toBe('');
  });

  it('removes Names, AcroForm, OpenAction, and AA catalog entries', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([612, 792]);

    // Populate catalog entries that stripPdfMetadata should remove.
    // `attach` registers an embedded file; the `Names` catalog entry is
    // written during `save`, so we round-trip through save+load to get a
    // populated input.
    await doc.attach(new Uint8Array([1, 2, 3, 4]), 'secret.bin', {
      mimeType: 'application/octet-stream',
    });
    doc.catalog.getOrCreateAcroForm();
    doc.catalog.set(PDFName.of('OpenAction'), doc.context.obj({}));
    doc.catalog.set(PDFName.of('AA'), doc.context.obj({}));

    const intermediate = await PDFDocument.load(new Uint8Array(await doc.save()), {
      updateMetadata: false,
    });

    // Sanity-check the precondition so a broken precondition can't silently
    // pass the postcondition.
    expect(intermediate.catalog.has(PDFName.of('Names'))).toBe(true);
    expect(intermediate.catalog.has(PDFName.of('AcroForm'))).toBe(true);
    expect(intermediate.catalog.has(PDFName.of('OpenAction'))).toBe(true);
    expect(intermediate.catalog.has(PDFName.of('AA'))).toBe(true);

    const input = new Uint8Array(await intermediate.save());

    const output = await stripPdfMetadata(input);

    const parsed = await PDFDocument.load(output, { updateMetadata: false });
    expect(parsed.catalog.has(PDFName.of('Names'))).toBe(false);
    expect(parsed.catalog.has(PDFName.of('AcroForm'))).toBe(false);
    expect(parsed.catalog.has(PDFName.of('OpenAction'))).toBe(false);
    expect(parsed.catalog.has(PDFName.of('AA'))).toBe(false);
  });
});
