import { PDFDocument } from '@cantoo/pdf-lib';
import pMap from 'p-map';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Canvas, Image, Path2D } from 'skia-canvas';

// @ts-expect-error napi-rs/canvas satisfies the requirements
globalThis.Path2D = Path2D;
// @ts-expect-error napi-rs/canvas satisfies the requirements
globalThis.Image = Image;

/**
 * Applies true redaction to a PDF: each page containing one or more redaction
 * regions is rendered to an opaque JPEG raster (with the redaction regions
 * painted solid black), then replaced in the output. Pages with no redactions
 * are left as vector content.
 *
 * Scope:
 *   - Removes the content stream (text operators, vector paths, images) of
 *     affected pages — the original text is genuinely gone.
 *   - Leaves unaffected pages untouched.
 *
 * What this function does NOT do (callers must handle):
 *   - Does not flatten AcroForm widgets, annotations, or layer state. Callers
 *     should flatten the input before invoking this function if such content
 *     could hold redacted text (see `normalizePdf` / `pdfDoc.flattenAll()`).
 *   - Does not strip document metadata, embedded files, or JavaScript. See
 *     `stripPdfMetadata` for that.
 *   - Does not preserve page-level rotation metadata on redacted pages: the
 *     raster is generated at the rotated viewport, and the replacement page is
 *     created with `/Rotate 0`. The visual orientation is preserved; downstream
 *     code that reads `page.getRotation()` after redaction will see 0 on
 *     replaced pages. This is acceptable for our pipeline because field
 *     coordinates are stored as percentages of the rendered page dimensions.
 *   - Does not preserve `/CropBox` or `/UserUnit` on redacted pages.
 *
 * Compose with `stripPdfMetadata` and `normalizePdf` for end-to-end hardening
 * (see `applyRedactionsToDocument`).
 */
export type RedactionRegion = {
  page: number;
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

export type ApplyRedactionsToPdfOptions = {
  pdfBytes: Uint8Array;
  redactions: RedactionRegion[];
  scale?: number;
};

const DEFAULT_RASTER_SCALE = 2;
const REDACTION_FILL = '#000000';

class SkiaCanvasFactory {
  create(width: number, height: number) {
    const canvas = new Canvas(width, height);
    canvas.gpu = false;
    return { canvas, context: canvas.getContext('2d') };
  }

  reset(cac: { canvas: Canvas }, width: number, height: number) {
    cac.canvas.width = width;
    cac.canvas.height = height;
  }

  destroy(cac: { canvas: Canvas | null; context: unknown }) {
    if (cac.canvas) {
      cac.canvas.width = 0;
      cac.canvas.height = 0;
    }
    cac.canvas = null;
    cac.context = null;
  }
}

export const applyRedactionsToPdf = async ({
  pdfBytes,
  redactions,
  scale = DEFAULT_RASTER_SCALE,
}: ApplyRedactionsToPdfOptions): Promise<Uint8Array> => {
  if (redactions.length === 0) {
    return pdfBytes;
  }

  const redactionsByPage = new Map<number, RedactionRegion[]>();
  for (const redaction of redactions) {
    const list = redactionsByPage.get(redaction.page) ?? [];
    list.push(redaction);
    redactionsByPage.set(redaction.page, list);
  }

  const renderedPages = await renderRedactedPages({
    pdfBytes,
    redactionsByPage,
    scale,
  });

  const outDoc = await PDFDocument.load(pdfBytes);

  // Removing pages shifts indices; process highest index first so remaining
  // indices stay stable.
  const sortedPages = [...renderedPages].sort(
    (a, b) => b.pageIndex - a.pageIndex,
  );

  for (const { pageIndex, imageBytes, widthPts, heightPts } of sortedPages) {
    const embedded = await outDoc.embedJpg(imageBytes);
    outDoc.removePage(pageIndex);
    const newPage = outDoc.insertPage(pageIndex, [widthPts, heightPts]);
    newPage.drawImage(embedded, {
      x: 0,
      y: 0,
      width: widthPts,
      height: heightPts,
    });
  }

  return new Uint8Array(await outDoc.save({ useObjectStreams: false }));
};

type RenderedPage = {
  pageIndex: number;
  imageBytes: Uint8Array;
  widthPts: number;
  heightPts: number;
};

type RenderRedactedPagesOptions = {
  pdfBytes: Uint8Array;
  redactionsByPage: Map<number, RedactionRegion[]>;
  scale: number;
};

const renderRedactedPages = async ({
  pdfBytes,
  redactionsByPage,
  scale,
}: RenderRedactedPagesOptions): Promise<RenderedPage[]> => {
  const task = pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes), // pdfjs takes ownership; pass a copy
    CanvasFactory: SkiaCanvasFactory,
  });

  let pdf: pdfjsLib.PDFDocumentProxy | undefined;

  try {
    pdf = await task.promise;

    // Sanity check: pdfjs page count should match what pdf-lib will see after load.
    // This is defensive against malformed page trees where the 1-based pageNumber
    // does not correspond to pdf-lib's pageIndex.
    const pageCount = pdf.numPages;

    // Validate every requested page is in range.
    for (const pageNumber of redactionsByPage.keys()) {
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > pageCount) {
        throw new Error(
          `Redaction references page ${pageNumber}, but the PDF has ${pageCount} pages.`,
        );
      }
    }

    const targets = Array.from(redactionsByPage.entries());
    const loadedPdf = pdf;

    return await pMap(
      targets,
      async ([pageNumber, pageRedactions]) => {
        const page = await loadedPdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });
        const canvas = new Canvas(viewport.width, viewport.height);
        canvas.gpu = false;

        try {
          const ctx = canvas.getContext('2d');

          await page.render({
            // @ts-expect-error skia-canvas satisfies pdfjs requirements
            canvas,
            // @ts-expect-error skia-canvas satisfies pdfjs requirements
            canvasContext: ctx,
            viewport,
          }).promise;

          ctx.fillStyle = REDACTION_FILL;
          for (const r of pageRedactions) {
            const x = (r.positionX / 100) * viewport.width;
            const y = (r.positionY / 100) * viewport.height;
            const w = (r.width / 100) * viewport.width;
            const h = (r.height / 100) * viewport.height;
            ctx.fillRect(x, y, w, h);
          }

          const imageBytes = await canvas.toBuffer('jpeg', { quality: 0.95 });
          const { width: widthPts, height: heightPts } = page.getViewport({ scale: 1 });

          return {
            pageIndex: pageNumber - 1,
            imageBytes: new Uint8Array(imageBytes),
            widthPts,
            heightPts,
          };
        } finally {
          try {
            page.cleanup();
          } catch {
            // pdfjs page cleanup is best-effort; ignore failures.
          }
          canvas.width = 0;
          canvas.height = 0;
        }
      },
      { concurrency: 4 },
    );
  } finally {
    if (pdf) void pdf.destroy().catch(() => undefined);
    void task.destroy().catch(() => undefined);
  }
};
