import { PDFDocument } from '@cantoo/pdf-lib';
import pMap from 'p-map';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Canvas, Image, Path2D } from 'skia-canvas';

// @ts-expect-error napi-rs/canvas satisfies the requirements
globalThis.Path2D = Path2D;
// @ts-expect-error napi-rs/canvas satisfies the requirements
globalThis.Image = Image;

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

  for (const { pageIndex, pngBytes, widthPts, heightPts } of sortedPages) {
    const embedded = await outDoc.embedPng(pngBytes);
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
  pngBytes: Uint8Array;
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
  const task = await pdfjsLib.getDocument({
    data: new Uint8Array(pdfBytes), // pdfjs takes ownership; pass a copy
    CanvasFactory: SkiaCanvasFactory,
  });
  const pdf = await task.promise;

  try {
    const targets = Array.from(redactionsByPage.entries());

    return await pMap(
      targets,
      async ([pageNumber, pageRedactions]) => {
        const page = await pdf.getPage(pageNumber);
        const viewport = page.getViewport({ scale });

        const canvas = new Canvas(viewport.width, viewport.height);
        canvas.gpu = false;
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

        const pngBytes = await canvas.toBuffer('png');

        const { width: widthPts, height: heightPts } = page.getViewport({ scale: 1 });

        void page.cleanup();

        return {
          pageIndex: pageNumber - 1,
          pngBytes: new Uint8Array(pngBytes),
          widthPts,
          heightPts,
        };
      },
      { concurrency: 4 },
    );
  } finally {
    void pdf.destroy().catch(() => undefined);
    void task.destroy().catch(() => undefined);
  }
};
