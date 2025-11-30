import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Canvas, Image } from 'skia-canvas';

import type { TDetectFormFieldsResponse } from './types';

export type RenderedPage = {
  image: Buffer;
  pageNumber: number;
  width: number;
  height: number;
};

const GRID_PADDING = { left: 80, top: 20, right: 20, bottom: 40 };
const GRID_INTERVAL = 100;
const FIELD_COLORS = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];

/**
 * Saves debug visualizations of detected form fields for development purposes.
 * Creates annotated images showing field bounding boxes and coordinate grids.
 */
export async function saveDebugVisualization(
  renderedPages: RenderedPage[],
  detectedFields: TDetectFormFieldsResponse,
): Promise<void> {
  const debugDir = join(process.cwd(), '..', '..', 'packages', 'assets', 'ai-previews');
  await mkdir(debugDir, { recursive: true });

  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');

  for (const page of renderedPages) {
    const canvas = createAnnotatedCanvas(page, detectedFields);
    await saveCanvasToFile(canvas, debugDir, timestamp, page.pageNumber);
  }
}

function createAnnotatedCanvas(
  page: RenderedPage,
  detectedFields: TDetectFormFieldsResponse,
): Canvas {
  const canvas = new Canvas(
    page.width + GRID_PADDING.left + GRID_PADDING.right,
    page.height + GRID_PADDING.top + GRID_PADDING.bottom,
  );
  const ctx = canvas.getContext('2d');

  // Draw the original page image
  const img = new Image();
  img.src = page.image;
  ctx.drawImage(img, GRID_PADDING.left, GRID_PADDING.top);

  // Draw coordinate grid
  drawCoordinateGrid(ctx, page.width, page.height);

  // Draw field bounding boxes
  drawFieldBoundingBoxes(ctx, page, detectedFields);

  // Draw axis labels
  drawAxisLabels(ctx, page.width, page.height);

  return canvas;
}

function drawCoordinateGrid(
  ctx: ReturnType<Canvas['getContext']>,
  pageWidth: number,
  pageHeight: number,
): void {
  ctx.strokeStyle = 'rgba(255, 0, 0, 0.5)';
  ctx.lineWidth = 1;

  // Draw vertical grid lines
  for (let i = 0; i <= 1000; i += GRID_INTERVAL) {
    const x = GRID_PADDING.left + (i / 1000) * pageWidth;
    ctx.beginPath();
    ctx.moveTo(x, GRID_PADDING.top);
    ctx.lineTo(x, pageHeight + GRID_PADDING.top);
    ctx.stroke();
  }

  // Draw horizontal grid lines
  for (let i = 0; i <= 1000; i += GRID_INTERVAL) {
    const y = GRID_PADDING.top + (i / 1000) * pageHeight;
    ctx.beginPath();
    ctx.moveTo(GRID_PADDING.left, y);
    ctx.lineTo(pageWidth + GRID_PADDING.left, y);
    ctx.stroke();
  }
}

function drawFieldBoundingBoxes(
  ctx: ReturnType<Canvas['getContext']>,
  page: RenderedPage,
  detectedFields: TDetectFormFieldsResponse,
): void {
  const pageFields = detectedFields.filter((field) => field.pageNumber === page.pageNumber);

  pageFields.forEach((field, index) => {
    const { ymin, xmin, ymax, xmax } = field.boundingBox;

    const x = (xmin / 1000) * page.width + GRID_PADDING.left;
    const y = (ymin / 1000) * page.height + GRID_PADDING.top;
    const width = ((xmax - xmin) / 1000) * page.width;
    const height = ((ymax - ymin) / 1000) * page.height;

    const color = FIELD_COLORS[index % FIELD_COLORS.length];
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.strokeRect(x, y, width, height);

    // Draw field label
    ctx.fillStyle = color;
    ctx.font = '20px Arial';
    ctx.fillText(field.label, x, y - 5);
  });
}

function drawAxisLabels(
  ctx: ReturnType<Canvas['getContext']>,
  pageWidth: number,
  pageHeight: number,
): void {
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 1;
  ctx.font = '26px Arial';

  // Draw Y-axis
  ctx.beginPath();
  ctx.moveTo(GRID_PADDING.left, GRID_PADDING.top);
  ctx.lineTo(GRID_PADDING.left, pageHeight + GRID_PADDING.top);
  ctx.stroke();

  // Y-axis labels
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';
  for (let i = 0; i <= 1000; i += GRID_INTERVAL) {
    const y = GRID_PADDING.top + (i / 1000) * pageHeight;
    ctx.fillStyle = '#000000';
    ctx.fillText(i.toString(), GRID_PADDING.left - 5, y);

    ctx.beginPath();
    ctx.moveTo(GRID_PADDING.left - 5, y);
    ctx.lineTo(GRID_PADDING.left, y);
    ctx.stroke();
  }

  // Draw X-axis
  ctx.beginPath();
  ctx.moveTo(GRID_PADDING.left, pageHeight + GRID_PADDING.top);
  ctx.lineTo(pageWidth + GRID_PADDING.left, pageHeight + GRID_PADDING.top);
  ctx.stroke();

  // X-axis labels
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let i = 0; i <= 1000; i += GRID_INTERVAL) {
    const x = GRID_PADDING.left + (i / 1000) * pageWidth;
    ctx.fillStyle = '#000000';
    ctx.fillText(i.toString(), x, pageHeight + GRID_PADDING.top + 5);

    ctx.beginPath();
    ctx.moveTo(x, pageHeight + GRID_PADDING.top);
    ctx.lineTo(x, pageHeight + GRID_PADDING.top + 5);
    ctx.stroke();
  }
}

async function saveCanvasToFile(
  canvas: Canvas,
  debugDir: string,
  timestamp: string,
  pageNumber: number,
): Promise<void> {
  const outputFilename = `detected_form_fields_${timestamp}_page_${pageNumber}.png`;
  const outputPath = join(debugDir, outputFilename);

  const pngBuffer = await canvas.toBuffer('png');
  await writeFile(outputPath, new Uint8Array(pngBuffer));
}
