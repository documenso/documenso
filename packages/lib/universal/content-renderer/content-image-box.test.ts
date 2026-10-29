import { describe, expect, it } from 'vitest';

import { CONTENT_IMAGE_DEFAULT_SIZE, resolveAttachedImageBox } from './content-image-box';

/**
 * US Letter in points.
 */
const PAGE = { width: 612, height: 792 };

const toPercentHeight = (points: number) => (points / PAGE.height) * 100;
const toPercentWidth = (points: number) => (points / PAGE.width) * 100;

describe('resolveAttachedImageBox', () => {
  it('keeps the box width and sets the height from the image ratio', () => {
    const box = { positionX: 10, positionY: 20, width: 50, height: 25 };

    const result = resolveAttachedImageBox({ image: { width: 200, height: 100 }, page: PAGE, box });

    // 50% of 612 is 306 points wide, so a 2:1 image is 153 points tall.
    expect(result.positionX).toBe(10);
    expect(result.positionY).toBe(20);
    expect(result.width).toBe(50);
    expect(result.height).toBeCloseTo(toPercentHeight(153));
  });

  it('grows a tall image past the box height rather than shrinking its width', () => {
    const box = { positionX: 10, positionY: 20, width: 50, height: 25 };

    const result = resolveAttachedImageBox({ image: { width: 100, height: 200 }, page: PAGE, box });

    // 306 points wide, so a 1:2 image is 612 points tall, which still fits
    // below 20% of the page.
    expect(result.width).toBe(50);
    expect(result.height).toBeCloseTo(toPercentHeight(612));
    expect(result.positionY + result.height).toBeLessThanOrEqual(100);
  });

  it('applies the same rule to a box still at its default size', () => {
    const box = { positionX: 10, positionY: 10, ...CONTENT_IMAGE_DEFAULT_SIZE };

    const result = resolveAttachedImageBox({ image: { width: 400, height: 200 }, page: PAGE, box });

    // The default 15% width is kept, the image's native size is irrelevant.
    expect(result.width).toBe(CONTENT_IMAGE_DEFAULT_SIZE.width);
    expect(result.height).toBeCloseTo(toPercentHeight(0.15 * PAGE.width * 0.5));
  });

  it('shrinks the box, ratio intact, when the height would run off the page', () => {
    const box = { positionX: 10, positionY: 80, width: 50, height: 10 };

    const result = resolveAttachedImageBox({ image: { width: 100, height: 200 }, page: PAGE, box });

    // Only 20% of the page (158.4 points) is left below the box, so the image
    // is 158.4 tall and 79.2 wide.
    expect(result.positionY).toBe(80);
    expect(result.positionY + result.height).toBeCloseTo(100);
    expect(result.height).toBeCloseTo(20);
    expect(result.width).toBeCloseTo(toPercentWidth(79.2));
    expect(result.width).toBeLessThan(box.width);
  });

  it('caps the width to the page when the box already runs past the right edge', () => {
    const box = { positionX: 90, positionY: 10, width: 30, height: 10 };

    const result = resolveAttachedImageBox({ image: { width: 200, height: 100 }, page: PAGE, box });

    expect(result.positionX).toBe(90);
    expect(result.positionX + result.width).toBeCloseTo(100);
    expect(result.height).toBeCloseTo(toPercentHeight(0.1 * PAGE.width * 0.5));
  });

  it('leaves the box untouched for a degenerate image or box', () => {
    const box = { positionX: 10, positionY: 20, width: 50, height: 25 };

    expect(resolveAttachedImageBox({ image: { width: 0, height: 0 }, page: PAGE, box })).toEqual(box);
    expect(
      resolveAttachedImageBox({ image: { width: 100, height: 100 }, page: PAGE, box: { ...box, width: 0 } }),
    ).toEqual({ ...box, width: 0 });
  });
});
