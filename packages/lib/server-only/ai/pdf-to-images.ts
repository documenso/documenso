import { createCanvas } from '@napi-rs/canvas';
import pMap from 'p-map';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

export type PdfToImagesOptions = {
  scale?: number;
};

export const pdfToImages = async (pdfBytes: Uint8Array, options: PdfToImagesOptions = {}) => {
  const { scale = 2 } = options;

  const pdf = await pdfjsLib.getDocument(pdfBytes).promise;

  const images = await pMap(
    Array.from({ length: pdf.numPages }),
    async (_, index) => {
      const pageNumber = index + 1;
      const page = await pdf.getPage(pageNumber);

      const viewport = page.getViewport({ scale });

      const canvas = createCanvas(viewport.width, viewport.height);
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
        image: await canvas.encode('jpeg'),
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
