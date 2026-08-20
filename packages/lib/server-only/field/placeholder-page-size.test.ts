import { PDFDocument, PDFName } from '@cantoo/pdf-lib';

import { describe, expect, it } from 'vitest';

import {
  mapBoundingBoxToFieldPosition,
  pickPageSize,
  resolveEffectivePageSizes,
} from './placeholder-page-size';

/**
 * Build a single-page PDF whose MediaBox lives ONLY on the /Pages node —
 * the inherited-MediaBox shape fpdf2 emits by default for same-size pages,
 * and the exact document class that mis-sized placeholder fields (#3267).
 */
async function inheritedMediaBoxPdf(width: number, height: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([width, height]);

  // pdf-lib writes the MediaBox onto each page; move it up to the parent
  // /Pages node so the page inherits it, per PDF 32000-1:2008 §7.7.3.4.
  const page = doc.getPage(0);
  const pagesNode = page.node.Parent();
  if (!pagesNode) throw new Error('fixture: page has no /Parent');
  pagesNode.set(
    PDFName.of('MediaBox'),
    doc.context.obj([0, 0, width, height]),
  );
  page.node.delete(PDFName.of('MediaBox'));

  return doc.save();
}

async function explicitMediaBoxPdf(width: number, height: number): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage([width, height]);
  return doc.save();
}

const A4 = { width: 595.28, height: 841.89 };

describe('resolveEffectivePageSizes', () => {
  it('resolves a MediaBox declared only on the /Pages node (A4, not US Letter)', async () => {
    const sizes = await resolveEffectivePageSizes(await inheritedMediaBoxPdf(A4.width, A4.height));

    expect(sizes).toHaveLength(1);
    expect(sizes[0]!.width).toBeCloseTo(A4.width, 2);
    expect(sizes[0]!.height).toBeCloseTo(A4.height, 2);
  });

  it('resolves an explicit per-page MediaBox identically', async () => {
    const sizes = await resolveEffectivePageSizes(await explicitMediaBoxPdf(A4.width, A4.height));

    expect(sizes[0]!.width).toBeCloseTo(A4.width, 2);
    expect(sizes[0]!.height).toBeCloseTo(A4.height, 2);
  });
});

describe('mapBoundingBoxToFieldPosition', () => {
  // A placeholder at 16mm on 210mm-wide A4 sits at 16/210 = 7.619% from the
  // left. With the US-Letter fallback (215.9mm) the same point computes as
  // 16/215.9 = 7.411% — the 0.97267 stretch ratio from the issue.
  it('maps coordinates against the A4 size, not the Letter fallback', () => {
    const bbox = { x: 45.35, y: 790, width: 100, height: 20 }; // 16mm ≈ 45.35pt
    const position = mapBoundingBoxToFieldPosition(bbox, A4);

    expect(position.positionX).toBeCloseTo((45.35 / 595.28) * 100, 3);
  });

  it('keeps the historical math for explicit sizes (regression guard)', () => {
    const bbox = { x: 100, y: 700, width: 120, height: 40 };
    const position = mapBoundingBoxToFieldPosition(bbox, { width: 612, height: 792 });

    expect(position.positionX).toBeCloseTo((100 / 612) * 100, 3);
    expect(position.positionY).toBeCloseTo(((792 - 700 - 40) / 792) * 100, 3);
    expect(position.width).toBeCloseTo((120 / 612) * 100, 3);
    expect(position.height).toBeCloseTo((40 / 792) * 100, 3);
  });

  it('honors explicit field width/height over bbox-derived percentages', () => {
    const position = mapBoundingBoxToFieldPosition(
      { x: 0, y: 0, width: 50, height: 10 },
      A4,
      { width: 15, height: 5 },
    );

    expect(position.width).toBe(15);
    expect(position.height).toBe(5);
  });
});

describe('pickPageSize', () => {
  it('prefers the resolved size when it differs (the inherited case)', () => {
    const picked = pickPageSize(A4, { width: 612, height: 792 });
    expect(picked).toBe(A4);
  });

  it('keeps the text-layer size when they agree (rotation semantics intact)', () => {
    const libpdf = { width: 792, height: 612 }; // rotated page: swapped
    const picked = pickPageSize({ width: 792, height: 612 }, libpdf);
    expect(picked).toBe(libpdf);
  });

  it('falls back to the text-layer size when resolution has no entry', () => {
    const libpdf = { width: 612, height: 792 };
    expect(pickPageSize(undefined, libpdf)).toBe(libpdf);
  });
});
