import { describe, expect, it } from 'vitest';

import { CONTENT_IMAGE_DEFAULT_SIZE, resolveAttachedImageBox } from './content-image-box';

/**
 * US Letter in points.
 */
const PAGE = { width: 612, height: 792 };

const toPercentWidth = (points: number) => (points / PAGE.width) * 100;
const toPercentHeight = (points: number) => (points / PAGE.height) * 100;

const defaultBox = (positionX = 10, positionY = 10) => ({
  positionX,
  positionY,
  ...CONTENT_IMAGE_DEFAULT_SIZE,
});

describe('resolveAttachedImageBox', () => {
  describe('with the default box', () => {
    it('sizes the box to the image at one point per pixel', () => {
      const box = resolveAttachedImageBox({ image: { width: 200, height: 100 }, page: PAGE, box: defaultBox() });

      expect(box.positionX).toBe(10);
      expect(box.positionY).toBe(10);
      expect(box.width).toBeCloseTo(toPercentWidth(200));
      expect(box.height).toBeCloseTo(toPercentHeight(100));
    });

    it('caps wide images at 80% of the page width, preserving the ratio', () => {
      const box = resolveAttachedImageBox({ image: { width: 2048, height: 512 }, page: PAGE, box: defaultBox() });

      expect(box.width).toBeCloseTo(80);
      expect(box.height).toBeCloseTo(toPercentHeight(0.8 * PAGE.width * (512 / 2048)));
    });

    it('caps tall images at 80% of the page height, preserving the ratio', () => {
      const box = resolveAttachedImageBox({ image: { width: 500, height: 2000 }, page: PAGE, box: defaultBox() });

      expect(box.height).toBeCloseTo(80);
      expect(box.width).toBeCloseTo(toPercentWidth(0.8 * PAGE.height * (500 / 2000)));
    });

    it('shifts the box into the page instead of clipping it', () => {
      const box = resolveAttachedImageBox({
        image: { width: 200, height: 100 },
        page: PAGE,
        box: defaultBox(90, 95),
      });

      expect(box.width).toBeCloseTo(toPercentWidth(200));
      expect(box.height).toBeCloseTo(toPercentHeight(100));
      expect(box.positionX + box.width).toBeCloseTo(100);
      expect(box.positionY + box.height).toBeCloseTo(100);
    });
  });

  describe('with a box the author has sized', () => {
    // 50% x 25% of US Letter is 306 x 198 points.
    const customBox = { positionX: 10, positionY: 20, width: 50, height: 25 };

    it('tightens the box around a wide image, centered where it would have rendered', () => {
      const box = resolveAttachedImageBox({ image: { width: 200, height: 100 }, page: PAGE, box: customBox });

      // The image fills the width (306 x 153) with 22.5 points spare above and below.
      expect(box.width).toBeCloseTo(50);
      expect(box.height).toBeCloseTo(toPercentHeight(153));
      expect(box.positionX).toBeCloseTo(10);
      expect(box.positionY).toBeCloseTo(20 + toPercentHeight(22.5));
    });

    it('tightens the box around a tall image', () => {
      const box = resolveAttachedImageBox({ image: { width: 100, height: 200 }, page: PAGE, box: customBox });

      // The image fills the height (99 x 198) with 103.5 points spare either side.
      expect(box.height).toBeCloseTo(25);
      expect(box.width).toBeCloseTo(toPercentWidth(99));
      expect(box.positionY).toBeCloseTo(20);
      expect(box.positionX).toBeCloseTo(10 + toPercentWidth(103.5));
    });

    it('never grows beyond the box the author drew', () => {
      const box = resolveAttachedImageBox({ image: { width: 4000, height: 4000 }, page: PAGE, box: customBox });

      expect(box.width).toBeLessThanOrEqual(customBox.width);
      expect(box.height).toBeLessThanOrEqual(customBox.height);
      expect(box.positionX).toBeGreaterThanOrEqual(customBox.positionX);
      expect(box.positionY).toBeGreaterThanOrEqual(customBox.positionY);
    });
  });

  it('leaves the box untouched for a degenerate image', () => {
    const box = { positionX: 10, positionY: 20, width: 50, height: 25 };

    expect(resolveAttachedImageBox({ image: { width: 0, height: 0 }, page: PAGE, box })).toEqual(box);
  });
});
