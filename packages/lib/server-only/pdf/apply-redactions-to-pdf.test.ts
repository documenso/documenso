import { PDFDocument, degrees, rgb } from '@cantoo/pdf-lib';
import { describe, expect, it } from 'vitest';

import { applyRedactionsToPdf } from './apply-redactions-to-pdf';

const makeTextPdf = async (text: string) => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  page.drawText(text, { x: 72, y: 720, size: 18, color: rgb(0, 0, 0) });
  page.drawText('KEEP THIS LINE', { x: 72, y: 120, size: 18, color: rgb(0, 0, 0) });
  return new Uint8Array(await doc.save());
};

const extractPageText = async (pdfBytes: Uint8Array): Promise<string> => {
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const task = await pdfjs.getDocument({ data: pdfBytes });
  const pdf = await task.promise;
  const page = await pdf.getPage(1);
  const content = await page.getTextContent();
  await pdf.destroy();
  return content.items.map((item) => ('str' in item ? item.str : '')).join(' ');
};

describe('applyRedactionsToPdf', () => {
  it('returns the input unchanged when no redactions are supplied', async () => {
    const input = await makeTextPdf('TOP SECRET PAYLOAD');

    const output = await applyRedactionsToPdf({ pdfBytes: input, redactions: [] });

    const text = await extractPageText(output);
    expect(text).toContain('TOP SECRET PAYLOAD');
    expect(text).toContain('KEEP THIS LINE');
  });

  it('removes the original text from a redacted page (true redaction)', async () => {
    const input = await makeTextPdf('TOP SECRET PAYLOAD');

    const output = await applyRedactionsToPdf({
      pdfBytes: input,
      redactions: [
        { page: 1, positionX: 5, positionY: 5, width: 80, height: 15 },
      ],
    });

    const text = await extractPageText(output);
    expect(text).not.toContain('TOP SECRET PAYLOAD');
    expect(text).not.toContain('KEEP THIS LINE');
    // Entire page is rasterized (not just the box), because the whole page
    // is replaced with an image. This is expected and documented.
  });

  it('leaves unredacted pages as vector content', async () => {
    const doc = await PDFDocument.create();
    const page1 = doc.addPage([612, 792]);
    page1.drawText('PAGE ONE SECRET', { x: 72, y: 720, size: 18 });
    const page2 = doc.addPage([612, 792]);
    page2.drawText('PAGE TWO PUBLIC', { x: 72, y: 720, size: 18 });
    const input = new Uint8Array(await doc.save());

    const output = await applyRedactionsToPdf({
      pdfBytes: input,
      redactions: [{ page: 1, positionX: 0, positionY: 0, width: 100, height: 100 }],
    });

    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    const pdf = await pdfjs.getDocument({ data: output }).promise;
    const page1Text = (await (await pdf.getPage(1)).getTextContent()).items;
    const page2Text = (await (await pdf.getPage(2)).getTextContent()).items;
    await pdf.destroy();

    expect(page1Text).toHaveLength(0);
    const page2Joined = page2Text.map((i) => ('str' in i ? i.str : '')).join(' ');
    expect(page2Joined).toContain('PAGE TWO PUBLIC');
  });

  it('preserves page count', async () => {
    const input = await makeTextPdf('hello');

    const output = await applyRedactionsToPdf({
      pdfBytes: input,
      redactions: [{ page: 1, positionX: 10, positionY: 10, width: 20, height: 10 }],
    });

    const parsed = await PDFDocument.load(output);
    expect(parsed.getPageCount()).toBe(1);
  });

  it('on a rotated page: removes text, replaces page with image at rotated dimensions and Rotate 0', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([612, 792]);
    page.drawText('ROTATED SECRET', { x: 72, y: 720, size: 18, color: rgb(0, 0, 0) });
    page.setRotation(degrees(90));
    const input = new Uint8Array(await doc.save());

    const output = await applyRedactionsToPdf({
      pdfBytes: input,
      redactions: [{ page: 1, positionX: 0, positionY: 0, width: 100, height: 100 }],
    });

    // pdfjs takes ownership of the input buffer, so load pdf-lib first.
    const parsed = await PDFDocument.load(output);
    expect(parsed.getPageCount()).toBe(1);
    const outPage = parsed.getPage(0);
    expect(outPage.getRotation().angle).toBe(0);
    // Rotated viewport: width and height are swapped.
    expect(Math.round(outPage.getWidth())).toBe(792);
    expect(Math.round(outPage.getHeight())).toBe(612);

    const text = await extractPageText(output);
    expect(text).not.toContain('ROTATED SECRET');
  });

  it('throws when a redaction references a page outside the document', async () => {
    const input = await makeTextPdf('hello');

    await expect(
      applyRedactionsToPdf({
        pdfBytes: input,
        redactions: [{ page: 99, positionX: 0, positionY: 0, width: 50, height: 50 }],
      }),
    ).rejects.toThrow(/page 99/);
  });
});
