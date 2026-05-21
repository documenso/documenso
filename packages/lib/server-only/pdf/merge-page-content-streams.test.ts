import { PDF, PdfArray, PdfStream, StandardFonts } from '@libpdf/core';
import { describe, expect, it } from 'vitest';

import { mergePageContentStreams } from './merge-page-content-streams';

const enc = (s: string) => new TextEncoder().encode(s);
const dec = (u: Uint8Array) => new TextDecoder('latin1').decode(u);

/**
 * Resolve a page's `/Contents`, following an indirect reference.
 */
const resolveContents = (doc: PDF) => {
  const resolve = doc.context.resolve.bind(doc.context);
  const page = doc.getPages()[0];
  let contents = page.dict.get('Contents');

  if (contents?.type === 'ref') {
    contents = resolve(contents) ?? undefined;
  }

  return { contents, resolve };
};

/**
 * Build a single-page PDF whose `/Contents` is an array of the given raw
 * (uncompressed) content-stream byte chunks.
 */
const buildArrayContentPdf = async (chunks: string[]): Promise<PDF> => {
  const doc = await PDF.create();
  doc.addPage();
  const page = doc.getPages()[0];
  const refs = chunks.map((chunk) => doc.createStream({}, enc(chunk)));
  page.dict.set('Contents', PdfArray.of(...refs));
  page.dict.dirty = true;

  return doc;
};

describe('mergePageContentStreams', () => {
  it('merges an array of content streams into a single stream, preserving order', async () => {
    const doc = await buildArrayContentPdf(['q 1 0 0 1 0 0 cm', '(PART_ONE) Tj', '(PART_TWO) Tj Q']);

    mergePageContentStreams(doc);

    const { contents } = resolveContents(doc);

    expect(contents).toBeInstanceOf(PdfStream);

    if (!(contents instanceof PdfStream)) {
      throw new Error('expected merged content to be a single stream');
    }

    const merged = dec(contents.getDecodedData());

    // All chunks survive, in order, separated by whitespace.
    expect(merged).toContain('q 1 0 0 1 0 0 cm');
    expect(merged).toContain('(PART_ONE) Tj');
    expect(merged).toContain('(PART_TWO) Tj Q');
    expect(merged.indexOf('PART_ONE')).toBeLessThan(merged.indexOf('PART_TWO'));
  });

  it('leaves a single-stream page untouched', async () => {
    const doc = await PDF.create();
    const page = doc.addPage();
    page.drawText('single stream content', { x: 50, y: 700, size: 12, font: StandardFonts.Helvetica });

    const before = page.dict.get('Contents');

    mergePageContentStreams(doc);

    // Same Contents reference - nothing was rewritten.
    expect(page.dict.get('Contents')).toBe(before);
  });

  it('survives a round-trip and keeps the page renderable', async () => {
    const doc = await buildArrayContentPdf(['q\n', 'Q\n', 'q Q\n']);

    mergePageContentStreams(doc);

    const bytes = Buffer.from(await doc.save());
    const reloaded = await PDF.load(new Uint8Array(bytes));
    const { contents } = resolveContents(reloaded);

    expect(contents).toBeInstanceOf(PdfStream);
  });

  it('never throws on a page without content', async () => {
    const doc = await PDF.create();
    doc.addPage();

    expect(() => mergePageContentStreams(doc)).not.toThrow();
  });
});
