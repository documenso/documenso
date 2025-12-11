import pMap from 'p-map';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import { Canvas, Image, Path2D } from 'skia-canvas';

// @ts-expect-error napi-rs/canvas satisfies the requirements
globalThis.Path2D = Path2D;
// @ts-expect-error napi-rs/canvas satisfies the requirements
globalThis.Image = Image;

class SkiaCanvasFactory {
  _createCanvas(width: number, height: number) {
    return new Canvas(width, height);
  }

  create(width: number, height: number) {
    const canvas = this._createCanvas(width, height);

    return {
      canvas,
      context: canvas.getContext('2d'),
    };
  }

  reset(canvasAndContext: { canvas: Canvas }, width: number, height: number) {
    canvasAndContext.canvas.width = width;
    canvasAndContext.canvas.height = height;
  }

  destroy(canvasAndContext: { canvas: Canvas | null; context: unknown }) {
    if (canvasAndContext.canvas) {
      canvasAndContext.canvas.width = 0;
      canvasAndContext.canvas.height = 0;
    }

    canvasAndContext.canvas = null;
    canvasAndContext.context = null;
  }
}

export type PdfToImagesOptions = {
  scale?: number;
};

export const pdfToImages = async (pdfBytes: Uint8Array, options: PdfToImagesOptions = {}) => {
  const { scale = 2 } = options;

  const pdf = await pdfjsLib.getDocument({
    data: pdfBytes,
    CanvasFactory: SkiaCanvasFactory,
  }).promise;

  const images = await pMap(
    Array.from({ length: pdf.numPages }),
    async (_, index) => {
      const pageNumber = index + 1;
      const page = await pdf.getPage(pageNumber);

      const viewport = page.getViewport({ scale });

      const canvas = new Canvas(viewport.width, viewport.height);
      const canvasContext = canvas.getContext('2d');

      await page.render({
        // @ts-expect-error napi-rs/canvas satifies the requirements
        canvas,
        // @ts-expect-error napi-rs/canvas satifies the requirements
        canvasContext,
        viewport,
      }).promise;

      return {
        pageNumber,
        image: await canvas.toBuffer('jpeg'),
        width: Math.floor(viewport.width),
        height: Math.floor(viewport.height),
        mimeType: 'image/jpeg',
      };
    },
    { concurrency: 10 },
  );

  void pdf.destroy();

  return images;
};
