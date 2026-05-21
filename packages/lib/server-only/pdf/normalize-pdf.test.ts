import { PDF, PdfArray, PdfStream, StandardFonts } from '@libpdf/core';
import { describe, expect, it } from 'vitest';

import { normalizePdf } from './normalize-pdf';

/**
 * Extract the concatenated text of every page of a PDF buffer.
 */
const extractAllText = async (pdf: Buffer): Promise<string> => {
  const doc = await PDF.load(new Uint8Array(pdf));

  return doc
    .extractText()
    .map((page) => page.text)
    .join('\n');
};

/**
 * Build a fillable form whose page `/Contents` is split across an array of
 * streams - the structure that previously made `form.flatten()` blank the page
 * (#28).
 */
const buildArrayContentForm = async (marker: string): Promise<Buffer> => {
  const pdf = await PDF.create();
  const form = pdf.getOrCreateForm();
  const page = pdf.addPage();
  page.drawText(marker, { x: 50, y: 700, size: 14, font: StandardFonts.Helvetica });
  const field = form.createTextField('field_1', { fontSize: 10 });
  page.drawField(field, { x: 50, y: 650, width: 200, height: 18 });

  // Reopen and split the single content stream into an array of two streams.
  const single = Buffer.from(await pdf.save());
  const doc = await PDF.load(new Uint8Array(single));
  const resolve = doc.context.resolve.bind(doc.context);
  const reopenedPage = doc.getPages()[0];

  let contents = reopenedPage.dict.get('Contents');

  if (contents?.type === 'ref') {
    contents = resolve(contents) ?? undefined;
  }

  if (!(contents instanceof PdfStream)) {
    throw new Error('expected a single content stream to split');
  }

  const decoded = contents.getDecodedData();
  const mid = Math.floor(decoded.length / 2);
  const ref1 = doc.createStream({}, decoded.slice(0, mid));
  const ref2 = doc.createStream({}, decoded.slice(mid));
  reopenedPage.dict.set('Contents', PdfArray.of(ref1, ref2));
  reopenedPage.dict.dirty = true;

  return Buffer.from(await doc.save());
};

describe('normalizePdf', () => {
  it('preserves page content when flattening a form (#28 regression)', async () => {
    const marker = 'PENINSULA_MARKER_TEXT';
    const pdf = await buildArrayContentForm(marker);

    const normalized = await normalizePdf(pdf, { flattenForm: true });

    // The static page text must survive the flatten.
    expect(await extractAllText(normalized)).toContain(marker);

    // The interactive form should have been flattened away.
    const reloaded = await PDF.load(new Uint8Array(normalized));
    const form = reloaded.getForm();
    expect(form === null || form.getFields().length === 0).toBe(true);
  });

  it('keeps the form interactive for templates (flattenForm: false)', async () => {
    const pdf = await buildArrayContentForm('TEMPLATE_MARKER');

    const normalized = await normalizePdf(pdf, { flattenForm: false });

    expect(await extractAllText(normalized)).toContain('TEMPLATE_MARKER');

    const reloaded = await PDF.load(new Uint8Array(normalized));
    expect(reloaded.getForm()?.getFields().length).toBeGreaterThan(0);
  });

  it('rejects an invalid PDF buffer', async () => {
    await expect(normalizePdf(Buffer.from('not a pdf'))).rejects.toThrow();
  });
});
