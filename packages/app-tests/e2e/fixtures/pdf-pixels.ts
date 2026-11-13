import { createCanvas } from '@napi-rs/canvas';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';

/**
 * Render the first page of a PDF and return the pixel at the centre of the
 * given percentage box.
 *
 * The caller's bytes stay usable: pdfjs transfers the buffer it is given to
 * its worker, so it gets a copy.
 */
export const samplePixelAtBoxCentre = async (
  pdfBytes: Uint8Array,
  box: { positionX: number; positionY: number; width: number; height: number },
) => {
  const pdf = await pdfjsLib.getDocument({ data: pdfBytes.slice() }).promise;
  const page = await pdf.getPage(1);

  const scale = 2;
  const viewport = page.getViewport({ scale });

  const canvas = createCanvas(viewport.width, viewport.height);
  const canvasContext = canvas.getContext('2d');

  await page.render({
    // @ts-expect-error @napi-rs/canvas satisfies runtime requirements for pdfjs
    canvas,
    // @ts-expect-error @napi-rs/canvas satisfies runtime requirements for pdfjs
    canvasContext,
    viewport,
  }).promise;

  const x = Math.round(viewport.width * ((box.positionX + box.width / 2) / 100));
  const y = Math.round(viewport.height * ((box.positionY + box.height / 2) / 100));

  const [r, g, b] = canvasContext.getImageData(x, y, 1, 1).data;

  return { r, g, b };
};

/**
 * Red/blue channel of pure green at the given opacity over white.
 *
 * A translucent fill makes a second draw measurable: two 40% layers of the
 * same colour compound to 64%, which reads as a much darker pixel.
 */
export const channelAtOpacity = (opacity: number) => Math.round(255 * (1 - opacity));
