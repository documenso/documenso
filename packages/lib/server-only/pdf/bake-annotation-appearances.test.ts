import { PDFDocument, PDFString, StandardFonts } from '@cantoo/pdf-lib';
import { PDF } from '@libpdf/core';
import { describe, expect, it } from 'vitest';

import { bakeAnnotationAppearances } from './bake-annotation-appearances';

const STATIC_MARKER = 'STATICPAGECONTENT';
const ANNOT_MARKERS = ['ANNOTVALUEALPHA', 'ANNOTVALUEBRAVO', 'ANNOTVALUECHARLIE'];

// Text is asserted with pdf.js, not @libpdf/core's extractText(): flattened
// annotations are drawn as Form XObjects (`/FlatAnnot0 Do`), and extractText()
// does not descend into XObjects, so it reports a false negative for content
// that renders perfectly well. pdf.js is the reference renderer the app's viewer
// uses, so "pdf.js can read it" is the meaningful assertion about what a signer
// actually sees.
const extractText = async (bytes: Uint8Array): Promise<string> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(bytes),
    isEvalSupported: false,
    useSystemFonts: false,
    verbosity: 0,
  }).promise;

  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    pages.push(
      content.items.map((item) => ('str' in item ? item.str : '')).join(' '),
    );
  }
  return pages.join('\n');
};

/**
 * Build a PDF whose only "typed" content lives in /FreeText annotations that
 * carry NO appearance stream — i.e. what pypdf / Stirling PDF / most scripted
 * annotators emit.
 */
const buildAnnotatedPdf = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  // Real page content, so we can prove text extraction works at all.
  page.drawText(STATIC_MARKER, { x: 50, y: 750, size: 12, font });

  const ctx = doc.context;
  const refs = ANNOT_MARKERS.map((marker, index) => {
    const y = 600 - index * 60;
    return ctx.register(
      ctx.obj({
        Type: 'Annot',
        Subtype: 'FreeText',
        Rect: [50, y, 400, y + 30],
        Contents: PDFString.of(marker),
        DA: PDFString.of('0 0 0 rg /Helv 12 Tf'),
        F: 4, // Print
      }),
    );
  });

  page.node.set(ctx.obj('Annots'), ctx.obj(refs));

  return doc.save({ useObjectStreams: false });
};

/** Run the same flatten + save the seal pipeline does, then extract text. */
const flattenAndExtract = async (bytes: Uint8Array) => {
  const pdf = await PDF.load(bytes);
  const flattenStats = pdf.flattenAll();
  pdf.upgradeVersion('1.7');
  const out = await pdf.save({ useXRefStream: true });

  return { flattenStats, text: await extractText(out), bytes: out };
};

describe('bakeAnnotationAppearances', () => {
  it('reproduces the drop of /AP-less /FreeText annotations on flatten (baseline)', async () => {
    const raw = await buildAnnotatedPdf();
    const rawBytes = Buffer.from(raw).toString('latin1');
    expect(ANNOT_MARKERS.every((m) => rawBytes.includes(m))).toBe(true);

    const baseline = await flattenAndExtract(raw);
    const baselineBytes = Buffer.from(baseline.bytes).toString('latin1');

    // Ordinary page content still survives...
    expect(baseline.text).toContain(STATIC_MARKER);
    // ...but every annotation value is gone from both the render and the bytes.
    for (const marker of ANNOT_MARKERS) {
      expect(baseline.text).not.toContain(marker);
      expect(baselineBytes).not.toContain(marker);
    }
  });

  it('preserves the annotation text through flatten after the pre-pass', async () => {
    const raw = await buildAnnotatedPdf();
    const baked = await bakeAnnotationAppearances(raw);

    expect(baked).not.toBe(raw);

    const fixed = await flattenAndExtract(baked);

    // The annotations are now flattened, not dropped.
    expect(fixed.flattenStats.annotations).toBe(ANNOT_MARKERS.length);
    expect(fixed.text).toContain(STATIC_MARKER);
    for (const marker of ANNOT_MARKERS) {
      expect(fixed.text).toContain(marker);
    }
  });

  it('returns an annotation-free PDF unchanged', async () => {
    const doc = await PDFDocument.create();
    const font = await doc.embedFont(StandardFonts.Helvetica);
    doc.addPage([612, 792]).drawText(STATIC_MARKER, { x: 50, y: 750, size: 12, font });
    const plainBytes = await doc.save({ useObjectStreams: false });

    const result = await bakeAnnotationAppearances(plainBytes);

    expect(result).toBe(plainBytes);
  });
});
