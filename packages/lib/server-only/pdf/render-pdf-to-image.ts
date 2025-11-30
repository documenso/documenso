import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Canvas, Image } from 'skia-canvas';

const require = createRequire(import.meta.url || fileURLToPath(new URL('.', import.meta.url)));
const Module = require('node:module');

const originalRequire = Module.prototype.require;
Module.prototype.require = function (path: string) {
  if (path === 'canvas') {
    return {
      createCanvas: (width: number, height: number) => new Canvas(width, height),
      Image, // needed by pdfjs-dist
    };
  }
  // eslint-disable-next-line prefer-rest-params, @typescript-eslint/consistent-type-assertions
  return originalRequire.apply(this, arguments as unknown as [string]);
};

// Use dynamic require to bypass Vite SSR transformation
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js');

export const renderPdfToImage = async (pdfBytes: Uint8Array) => {
  const loadingTask = pdfjsLib.getDocument({ data: pdfBytes });
  const pdf = await loadingTask.promise;

  try {
    const scale = 2;

    const results = await Promise.allSettled(
      Array.from({ length: pdf.numPages }, async (_, index) => {
        const pageNumber = index + 1;
        const page = await pdf.getPage(pageNumber);

        try {
          const viewport = page.getViewport({ scale });

          const virtualCanvas = new Canvas(viewport.width, viewport.height);
          const context = virtualCanvas.getContext('2d');
          context.imageSmoothingEnabled = false;

          await page.render({ canvasContext: context, viewport }).promise;

          return {
            image: await virtualCanvas.toBuffer('png'),
            pageNumber,
            width: Math.floor(viewport.width),
            height: Math.floor(viewport.height),
          };
        } finally {
          page.cleanup();
        }
      }),
    );

    const pages = results
      .filter(
        (
          result,
        ): result is PromiseFulfilledResult<{
          image: Buffer;
          pageNumber: number;
          width: number;
          height: number;
        }> => result.status === 'fulfilled',
      )
      .map((result) => result.value);

    if (results.some((result) => result.status === 'rejected')) {
      const failedReasons = results
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map((result) => result.reason);

      // Note: We don't have logger available in this package
      // Errors are handled by the caller in document-analysis/index.ts
      // which will use the proper logger for reporting failures
    }

    return pages;
  } finally {
    await pdf.destroy();
  }
};
