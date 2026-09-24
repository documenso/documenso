import { clamp } from 'remeda';

/**
 * Shared geometry primitives for anything positioned on a page, i.e. fields
 * and contents, in both the editor canvas and the PDF export.
 *
 * Positions and sizes are stored as percentages of the page and converted to
 * pixels (or points) for the surface being drawn on.
 */

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

/**
 * A box stored as percentages of the page.
 */
export type PercentageBox = {
  positionX: number;
  positionY: number;
  width: number;
  height: number;
};

export const clampPercentage = (value: number) => clamp(value, { min: 0, max: 100 });

/**
 * A percentage of `total`, in the same unit as `total`.
 */
export const toPixels = (percentage: number, total: number) => (percentage / 100) * total;

/**
 * The percentage of `total` that `pixels` represents.
 */
export const toPercentage = (pixels: number, total: number) => (pixels / total) * 100;

/**
 * Convert a percentage box into the page's unit.
 */
export const toPixelRect = (box: PercentageBox, page: Size): Rect => ({
  x: toPixels(box.positionX, page.width),
  y: toPixels(box.positionY, page.height),
  width: toPixels(box.width, page.width),
  height: toPixels(box.height, page.height),
});

/**
 * Convert a rect in the page's unit into a percentage box.
 */
export const toPercentageBox = (rect: Rect, page: Size): PercentageBox => ({
  positionX: toPercentage(rect.x, page.width),
  positionY: toPercentage(rect.y, page.height),
  width: toPercentage(rect.width, page.width),
  height: toPercentage(rect.height, page.height),
});

/**
 * Clamp every side of a percentage box to the page.
 */
export const clampPercentageBox = <T extends PercentageBox>(box: T): T => ({
  ...box,
  positionX: clampPercentage(box.positionX),
  positionY: clampPercentage(box.positionY),
  width: clampPercentage(box.width),
  height: clampPercentage(box.height),
});
