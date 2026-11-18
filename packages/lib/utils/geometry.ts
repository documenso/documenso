import { clamp } from 'remeda';

export type Size = {
  width: number;
  height: number;
};

export type Rect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type PercentageBox = {
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

/**
 * Five decimal places is far below a pixel at any page size and zoom while
 * still keeping float noise from the canvas (e.g. `33.300000000000004`) out of
 * the stored values and their diffs. Only contents are rounded; fields are stored as is.
 */
export const FIVE_DECIMAL_PLACES = 5;

export const roundTo = (value: number, decimals: number) => {
  const factor = 10 ** decimals;

  // `+ 0` turns a `-0` result into `0`.
  return Math.round(value * factor) / factor + 0;
};

export const clampPercentage = (value: number) => clamp(value, { min: 0, max: 100 });

export const toPixels = (percentage: number, total: number) => (percentage / 100) * total;

export const toPercentage = (pixels: number, total: number) => (pixels / total) * 100;

export const toPixelRect = (box: PercentageBox, page: Size): Rect => ({
  x: toPixels(box.positionX, page.width),
  y: toPixels(box.positionY, page.height),
  width: toPixels(box.width, page.width),
  height: toPixels(box.height, page.height),
});

export const toPercentageBox = (rect: Rect, page: Size): PercentageBox => ({
  positionX: toPercentage(rect.x, page.width),
  positionY: toPercentage(rect.y, page.height),
  width: toPercentage(rect.width, page.width),
  height: toPercentage(rect.height, page.height),
});

export const clampPercentageBox = <T extends PercentageBox>(box: T): T => ({
  ...box,
  positionX: clampPercentage(box.positionX),
  positionY: clampPercentage(box.positionY),
  width: clampPercentage(box.width),
  height: clampPercentage(box.height),
});
