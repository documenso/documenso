import pMap from 'p-map';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';
import type { ExportFormat } from 'skia-canvas';
import { Canvas, Image, Path2D } from 'skia-canvas';

import { PDF_IMAGE_RENDER_SCALE } from '../../constants/pdf-viewer';

// @ts-expect-error napi-rs/canvas satisfies the requirements
globalThis.Path2D = Path2D;
// @ts-expect-error napi-rs/canvas satisfies the requirements
globalThis.Image = Image;

class SkiaCanvasFactory {
  _createCanvas(width: number, height: number) {
    const canvas = new Canvas(width, height);
    canvas.gpu = false;

    return canvas;
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

  /**
   * The format of the images to return.
   *
   * Defaults to 'jpeg'.
   */
  imageFormat?: ExportFormat;
};

export const pdfToImages = async (pdfBytes: Uint8Array, options: PdfToImagesOptions = {}) => {
  const { scale = PDF_IMAGE_RENDER_SCALE, imageFormat = 'jpeg' } = options;

  const task = await pdfjsLib.getDocument({
    data: pdfBytes,
    CanvasFactory: SkiaCanvasFactory,
  });

  const pdf = await task.promise;

  const images = await pMap(
    Array.from({ length: pdf.numPages }),
    async (_, pageIndex) => getPdfPageAsImage({ pdf, pageIndex, scale, imageFormat }),
    { concurrency: 10 },
  );

  void pdf.destroy().catch((e) => console.error(e));
  void task.destroy().catch((e) => console.error(e));

  return images;
};

export type PdfToImageOptions = {
  scale?: number;
  pageIndex: number;

  /**
   * The format of the image to return.
   * Defaults to 'jpeg'.
   */
  imageFormat?: ExportFormat;
};

export const pdfToImage = async (pdfBytes: Uint8Array, options: PdfToImageOptions) => {
  const { scale = PDF_IMAGE_RENDER_SCALE, pageIndex, imageFormat = 'jpeg' } = options;

  if (pageIndex !== undefined && pageIndex < 0) {
    throw new Error('Page index must be greater than or equal to 0');
  }

  const task = await pdfjsLib.getDocument({
    data: pdfBytes,
    CanvasFactory: SkiaCanvasFactory,
  });

  const pdf = await task.promise;

  const image = await getPdfPageAsImage({ pdf, pageIndex, scale, imageFormat });

  void pdf.destroy().catch((e) => console.error(e));
  void task.destroy().catch((e) => console.error(e));

  return image;
};

type GetPdfPageAsImageOptions = {
  pdf: PDFDocumentProxy;
  pageIndex: number;
  scale: number;
  imageFormat: ExportFormat;
};

const getPdfPageAsImage = async ({
  pdf,
  pageIndex,
  scale,
  imageFormat,
}: GetPdfPageAsImageOptions) => {
  const page = await pdf.getPage(pageIndex + 1);

  const viewport = page.getViewport({ scale });

  const canvas = new Canvas(viewport.width, viewport.height);
  canvas.gpu = false;

  const canvasContext = canvas.getContext('2d');

  await page.render({
    // @ts-expect-error napi-rs/canvas satifies the requirements
    canvas,
    // @ts-expect-error napi-rs/canvas satifies the requirements
    canvasContext,
    viewport,
  }).promise;

  const originalViewport = page.getViewport({ scale: 1 });

  const result = {
    pageIndex,
    pageNumber: pageIndex + 1,
    image: await canvas.toBuffer(imageFormat),
    originalWidth: originalViewport.width,
    originalHeight: originalViewport.height,
    scale,
    scaledWidth: Math.floor(viewport.width),
    scaledHeight: Math.floor(viewport.height),
  };

  void page.cleanup();

  return result;
};
