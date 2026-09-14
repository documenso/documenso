import { readFileSync } from 'node:fs';
import path from 'node:path';
import { Canvas } from '@documenso/skia-canvas';
import { PDF, PdfArray, PdfDict, PdfNumber } from '@libpdf/core';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import sharp from 'sharp';
import { beforeAll, describe, expect, it } from 'vitest';

import { ContentShapeType, EnvelopeContentType } from '../../types/envelope-content-meta';
import { createSkiaImage } from '../konva/skia-image';
import { insertPageOverlay } from './insert-page-overlay';

/**
 * A box content covering 10-60% horizontally and 20-45% vertically.
 */
const RECT = { positionX: 10, positionY: 20, width: 50, height: 25 };

const STROKE_WIDTH = 2;

type PixelMatcher = (r: number, g: number, b: number) => boolean;

const isRed: PixelMatcher = (r, g, b) => r > 180 && g < 90 && b < 90;
const isBlue: PixelMatcher = (r, g, b) => r < 90 && g < 90 && b > 180;

type Overlay = Pick<Parameters<typeof insertPageOverlay>[0], 'contents' | 'images'>;

/**
 * A red stroked rectangle content at `RECT`.
 */
const RED_RECTANGLE_OVERLAY: Overlay = {
  contents: [
    {
      id: 'content',
      metadata: {
        type: EnvelopeContentType.SHAPE,
        shape: ContentShapeType.RECTANGLE,
        page: 1,
        rotation: 0,
        ...RECT,
        strokeWidth: STROKE_WIDTH,
        strokeColor: '#ff0000',
        strokeStyle: 'solid',
      },
      dataContentId: null,
      zIndex: 0,
    },
  ],
};

/**
 * A solid blue image twice as wide as it is tall.
 */
const IMAGE_SIZE = { width: 200, height: 100 };

const createBlueImageOverlay = async (): Promise<Overlay> => {
  const png = await sharp({
    create: {
      ...IMAGE_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 255, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  return {
    contents: [
      {
        id: 'content',
        metadata: {
          type: EnvelopeContentType.IMAGE,
          page: 1,
          rotation: 0,
          ...RECT,
        },
        dataContentId: 'data_blue',
        zIndex: 0,
      },
    ],
    images: new Map([['data_blue', createSkiaImage(new Uint8Array(png))]]),
  };
};

/**
 * Render at a high resolution so sub point placement errors become several
 * pixels and cannot hide inside antialiasing.
 */
const RENDER_WIDTH = 2400;

const FIXTURE = path.join(__dirname, '../../../assets/documenso-supporter-pledge.pdf');

/**
 * The fonts are resolved relative to the working directory of the app.
 */
beforeAll(() => {
  process.chdir(path.join(__dirname, '../../../../apps/remix'));
});

type PageSetup = {
  /**
   * Create a blank page of this size instead of loading the fixture.
   */
  size?: { width: number; height: number };
  rotation?: 0 | 90 | 180 | 270;
  cropBox?: [number, number, number, number];
  mediaBox?: [number, number, number, number];

  /**
   * Move the MediaBox and Rotate off the page and onto the parent pages node,
   * so they are inherited rather than defined on the page itself.
   */
  inherit?: boolean;

  /**
   * The contents to burn in, defaulting to the red rectangle.
   */
  overlay?: Overlay;

  /**
   * Which rasterized pixels to measure, defaulting to the red stroke.
   */
  matchPixel?: PixelMatcher;
};

const toPdfArray = (values: number[]) => new PdfArray(values.map((value) => PdfNumber.of(value)));

type CanvasAndContext = {
  canvas: Canvas | null;
  context: ReturnType<Canvas['getContext']> | null;
};

/**
 * Have pdf.js create its offscreen canvases (e.g. for decoding embedded
 * images) with skia-canvas, since it otherwise defaults to `@napi-rs/canvas`
 * whose canvases cannot be drawn onto the skia canvas we rasterize into.
 *
 * pdf.js instantiates the factory with `new`, hence a constructor function.
 */
function SkiaCanvasFactory() {
  return {
    create(width: number, height: number): CanvasAndContext {
      const canvas = new Canvas(width, height);

      return { canvas, context: canvas.getContext('2d') };
    },
    reset(target: CanvasAndContext, width: number, height: number) {
      if (!target.canvas) {
        throw new Error('Canvas is not specified');
      }

      target.canvas.width = width;
      target.canvas.height = height;
    },
    destroy(target: CanvasAndContext) {
      target.canvas = null;
      target.context = null;
    },
  };
}

/**
 * Burn a content into page 1 via the real overlay pipeline, rasterize the
 * result with pdf.js exactly like the client viewer does, and return the
 * pixel bounds of the matching pixels alongside the bounds the client would
 * draw the `RECT` box at.
 */
const roundtrip = async ({
  size,
  rotation,
  cropBox,
  mediaBox,
  inherit,
  overlay = RED_RECTANGLE_OVERLAY,
  matchPixel = isRed,
}: PageSetup) => {
  let pdfDoc: PDF;

  if (size) {
    pdfDoc = await PDF.create();
    pdfDoc.addPage(size);
  } else {
    pdfDoc = await PDF.load(new Uint8Array(readFileSync(FIXTURE)));
  }

  const page = pdfDoc.getPage(0);

  if (!page) {
    throw new Error('Missing page');
  }

  if (mediaBox) {
    page.dict.set('MediaBox', toPdfArray(mediaBox));
  }

  if (rotation !== undefined) {
    page.setRotation(rotation);
  }

  if (cropBox) {
    page.dict.set('CropBox', toPdfArray(cropBox));
  }

  if (inherit) {
    const parentRef = page.dict.getRef('Parent');
    const parent = parentRef ? pdfDoc.getObject(parentRef) : null;

    if (!(parent instanceof PdfDict)) {
      throw new Error('Expected the page to have a parent pages node');
    }

    for (const key of ['MediaBox', 'Rotate']) {
      const value = page.dict.get(key);

      if (value !== undefined) {
        parent.set(key, value);
        page.dict.delete(key);
      }
    }
  }

  await insertPageOverlay({
    pdfDoc,
    page,
    fields: [],
    ...overlay,
  });

  const sealed = await pdfDoc.save({ useXRefStream: true });

  // Rasterize like the client: the scale is relative to the viewport at scale 1.
  const doc = await pdfjs.getDocument({ data: sealed.slice(), CanvasFactory: SkiaCanvasFactory }).promise;
  const pdfjsPage = await doc.getPage(1);
  const baseViewport = pdfjsPage.getViewport({ scale: 1 });
  const scale = RENDER_WIDTH / baseViewport.width;
  const viewport = pdfjsPage.getViewport({ scale });

  const canvas = new Canvas(Math.floor(viewport.width), Math.floor(viewport.height));
  const context = canvas.getContext('2d');

  await pdfjsPage.render({ canvasContext: context as never, viewport, canvas: canvas as never }).promise;

  const image = context.getImageData(0, 0, canvas.width, canvas.height);

  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;

      if (matchPixel(image.data[i], image.data[i + 1], image.data[i + 2])) {
        minX = Math.min(minX, x);
        maxX = Math.max(maxX, x);
        minY = Math.min(minY, y);
        maxY = Math.max(maxY, y);
      }
    }
  }

  // What the client draws: percentages of the pdf.js viewport at scale 1.
  const edges = {
    left: (RECT.positionX / 100) * baseViewport.width * scale,
    right: ((RECT.positionX + RECT.width) / 100) * baseViewport.width * scale,
    top: (RECT.positionY / 100) * baseViewport.height * scale,
    bottom: ((RECT.positionY + RECT.height) / 100) * baseViewport.height * scale,
  };

  return {
    actual: { minX, minY, maxX, maxY },
    edges,
    halfStroke: (STROKE_WIDTH / 2) * scale,
    scale,
    baseViewport: { width: baseViewport.width, height: baseViewport.height },
  };
};

/**
 * The stroke is centered on the rectangle edge, so the solid red pixels span
 * from half a stroke width outside one edge to half a stroke width outside the
 * opposite edge, less up to one pixel of antialiasing at each end.
 *
 * Pixel indices address the near side of a pixel, so the far edges compare
 * against the index plus one.
 */
const expectAligned = (
  { actual, edges, halfStroke }: Awaited<ReturnType<typeof roundtrip>>,
  { tolerance = 1.5 }: { tolerance?: number } = {},
) => {
  const outer = {
    left: edges.left - halfStroke,
    right: edges.right + halfStroke,
    top: edges.top - halfStroke,
    bottom: edges.bottom + halfStroke,
  };

  expect(Math.abs(actual.minX - outer.left)).toBeLessThan(tolerance);
  expect(Math.abs(actual.maxX + 1 - outer.right)).toBeLessThan(tolerance);
  expect(Math.abs(actual.minY - outer.top)).toBeLessThan(tolerance);
  expect(Math.abs(actual.maxY + 1 - outer.bottom)).toBeLessThan(tolerance);
};

/**
 * A4 as written by common producers, i.e. 210mm x 297mm in points.
 */
const A4_SIZE = { width: 595.276, height: 841.89 };

describe('insertPageOverlay', () => {
  it('aligns with the client on a standard page', async () => {
    expectAligned(await roundtrip({}));
  }, 60000);

  it('aligns with the client on a page with an offset crop box', async () => {
    expectAligned(await roundtrip({ cropBox: [30, 40, 582, 752] }));
  }, 60000);

  it('aligns with the client on a page with an offset media box', async () => {
    expectAligned(await roundtrip({ mediaBox: [20, 30, 632, 822] }));
  }, 60000);

  it('aligns with the client on a page with inherited attributes', async () => {
    expectAligned(await roundtrip({ rotation: 90, inherit: true }));
  }, 60000);

  it.each([90, 180, 270] as const)('aligns with the client on a page rotated %d degrees', async (rotation) => {
    expectAligned(await roundtrip({ rotation }));
  }, 60000);

  it('aligns with the client on a rotated page with an offset crop box', async () => {
    expectAligned(await roundtrip({ rotation: 90, cropBox: [30, 40, 582, 752] }));
  }, 60000);

  it('aligns with the client on a page with a fractional size, within the accepted residual', async () => {
    const result = await roundtrip({ size: A4_SIZE });

    // Skia writes the overlay page at a whole point size, leaving a residual
    // of at most half a point on fractional pages, which is accepted.
    const scale = RENDER_WIDTH / A4_SIZE.width;

    expectAligned(result, { tolerance: 1.5 + 0.5 * scale });
  }, 60000);

  it('burns an image content into the page, fitted within its box', async () => {
    const { actual, scale, baseViewport } = await roundtrip({
      overlay: await createBlueImageOverlay(),
      matchPixel: isBlue,
    });

    // The box in unscaled page pixels, as the client lays it out.
    const box = {
      x: (RECT.positionX / 100) * baseViewport.width,
      y: (RECT.positionY / 100) * baseViewport.height,
      width: (RECT.width / 100) * baseViewport.width,
      height: (RECT.height / 100) * baseViewport.height,
    };

    // A 2:1 image in this box is limited by the box width, so it spans the
    // full width and is centered vertically with bands above and below.
    const fitScale = Math.min(box.width / IMAGE_SIZE.width, box.height / IMAGE_SIZE.height);
    const drawn = { width: IMAGE_SIZE.width * fitScale, height: IMAGE_SIZE.height * fitScale };

    expect(drawn.width).toBeCloseTo(box.width);
    expect(drawn.height).toBeLessThan(box.height);

    const expected = {
      left: box.x * scale,
      right: (box.x + box.width) * scale,
      top: (box.y + (box.height - drawn.height) / 2) * scale,
      bottom: (box.y + (box.height + drawn.height) / 2) * scale,
    };

    const tolerance = 1.5;

    expect(Math.abs(actual.minX - expected.left)).toBeLessThan(tolerance);
    expect(Math.abs(actual.maxX + 1 - expected.right)).toBeLessThan(tolerance);
    expect(Math.abs(actual.minY - expected.top)).toBeLessThan(tolerance);
    expect(Math.abs(actual.maxY + 1 - expected.bottom)).toBeLessThan(tolerance);
  }, 60000);

  it('refuses to export an image content whose image has not been loaded', async () => {
    const pdfDoc = await PDF.create();
    pdfDoc.addPage({ width: 612, height: 792 });

    const page = pdfDoc.getPage(0);

    if (!page) {
      throw new Error('Missing page');
    }

    const { contents } = await createBlueImageOverlay();

    await expect(insertPageOverlay({ pdfDoc, page, fields: [], contents, images: new Map() })).rejects.toMatchObject({
      code: 'MISSING_CONTENT_IMAGE',
    });
  }, 60000);
});
