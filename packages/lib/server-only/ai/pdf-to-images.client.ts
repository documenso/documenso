import pMap from 'p-map';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

export type PdfToImagesOptions = {
  scale?: number;
};

export type PdfImageResult = {
  pageIndex: number;
  image: string;
  width: number;
  height: number;
};

export const pdfToImagesClientSide = async (
  pdfBytes: Uint8Array,
  options: PdfToImagesOptions = {},
): Promise<PdfImageResult[]> => {
  const { scale = 2 } = options;

  const task = pdfjsLib.getDocument({
    data: pdfBytes,
  });

  const pdf = await task.promise;

  const images = await pMap(
    Array.from({ length: pdf.numPages }),
    async (_, pageIndex) => {
      const pageNumber = pageIndex + 1;
      const page = await pdf.getPage(pageNumber);

      const viewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);

      const context = canvas.getContext('2d');
      if (!context) {
        throw new Error('Failed to get 2D canvas context');
      }

      await page.render({
        canvasContext: context,
        viewport,
        canvas,
      }).promise;

      const imageBase64 = canvas.toDataURL('image/jpeg');

      page.cleanup();

      return {
        pageIndex,
        image: imageBase64,
        width: canvas.width,
        height: canvas.height,
      };
    },
    { concurrency: 50 },
  );

  await pdf.destroy();
  await task.destroy();

  return images;
};
