import { describe, expect, it } from 'vitest';

import { boundTransformerBoxToPage, boundTransformerBoxToPageKeepingRatio, type TransformerBox } from './transformer';

const PAGE = { width: 800, height: 1000 };

const box = (x: number, y: number, width: number, height: number, rotation = 0): TransformerBox => ({
  x,
  y,
  width,
  height,
  rotation,
});

/**
 * The absolute corners of a box, rotated about its origin like Konva does.
 */
const cornersOf = ({ x, y, width, height, rotation }: TransformerBox) => {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);

  return [
    [0, 0],
    [width, 0],
    [0, height],
    [width, height],
  ].map(([lx, ly]) => ({ x: x + lx * cos - ly * sin, y: y + lx * sin + ly * cos }));
};

const expectOnPage = (b: TransformerBox) => {
  for (const corner of cornersOf(b)) {
    expect(corner.x).toBeGreaterThanOrEqual(-1e-6);
    expect(corner.x).toBeLessThanOrEqual(PAGE.width + 1e-6);
    expect(corner.y).toBeGreaterThanOrEqual(-1e-6);
    expect(corner.y).toBeLessThanOrEqual(PAGE.height + 1e-6);
  }
};

const expectCornerClose = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  expect(a.x).toBeCloseTo(b.x, 6);
  expect(a.y).toBeCloseTo(b.y, 6);
};

describe('boundTransformerBoxToPage', () => {
  it('leaves a box within the page untouched', () => {
    const inside = box(100, 100, 200, 150);

    expect(boundTransformerBoxToPage(box(100, 100, 180, 140), inside, PAGE)).toEqual(inside);
  });

  it('pins the right edge to the page while a right anchor is dragged past it', () => {
    // Dragging the right edge from 700 to 900 stops at the page edge.
    const bounded = boundTransformerBoxToPage(box(500, 100, 200, 150), box(500, 100, 400, 150), PAGE);

    expect(bounded).toEqual(box(500, 100, 300, 150));
  });

  it('pins the bottom edge to the page', () => {
    const bounded = boundTransformerBoxToPage(box(100, 900, 200, 80), box(100, 900, 200, 300), PAGE);

    expect(bounded).toEqual(box(100, 900, 200, 100));
  });

  it('pins the left edge to the page, keeping the right edge where it was', () => {
    // Dragging the left anchor to x = -50 pins it at 0 and shrinks the width
    // so the opposite edge stays put at 250.
    const bounded = boundTransformerBoxToPage(box(50, 100, 200, 150), box(-50, 100, 300, 150), PAGE);

    expect(bounded).toEqual(box(0, 100, 250, 150));
  });

  it('pins the top edge to the page, keeping the bottom edge where it was', () => {
    const bounded = boundTransformerBoxToPage(box(100, 20, 200, 130), box(100, -30, 200, 180), PAGE);

    expect(bounded).toEqual(box(100, 0, 200, 150));
  });

  it('pins the axes independently, so the other axis still follows the mouse', () => {
    // Only the width overflows; the height change is kept as is.
    const bounded = boundTransformerBoxToPage(box(600, 100, 150, 200), box(600, 100, 300, 400), PAGE);

    expect(bounded).toEqual(box(600, 100, 200, 400));
  });

  it('keeps every corner of a rotated box on the page, anchored on the fixed corner', () => {
    // A box rotated 45 degrees near the right edge, with its bottom right
    // anchor dragged outwards so the far corners leave the page.
    // At 45 degrees the top right corner heads up and right, so a wide
    // enough box pushes it past the right edge of the page.
    const rotation = Math.PI / 4;
    const old = box(500, 300, 100, 60, rotation);
    const proposed = box(500, 300, 600, 100, rotation);

    expect(cornersOf(proposed).some((corner) => corner.x > PAGE.width)).toBe(true);

    const bounded = boundTransformerBoxToPage(old, proposed, PAGE);

    expectOnPage(bounded);
    expect(bounded.rotation).toBe(rotation);

    // The top left corner, which was not dragged, has not moved, and the
    // box was clamped rather than passed through.
    expectCornerClose(cornersOf(bounded)[0], cornersOf(proposed)[0]);
    expect(bounded.width).toBeLessThan(proposed.width);
  });

  it('anchors a rotated box on its bottom right when the top left anchor is dragged', () => {
    const rotation = Math.PI / 6;
    const old = box(400, 400, 100, 60, rotation);

    // Grow the box backwards from the bottom right, which stays fixed, far
    // enough that the new top left leaves the page.
    const fixed = cornersOf(old)[3];
    const proposed = box(
      fixed.x - 900 * Math.cos(rotation) + 600 * Math.sin(rotation),
      fixed.y - 900 * Math.sin(rotation) - 600 * Math.cos(rotation),
      900,
      600,
      rotation,
    );

    const bounded = boundTransformerBoxToPage(old, proposed, PAGE);

    expectOnPage(bounded);
    expectCornerClose(cornersOf(bounded)[3], fixed);
  });
});

describe('boundTransformerBoxToPageKeepingRatio', () => {
  // A 2:1 box with its top left corner at (500, 100).
  const old = box(500, 100, 200, 100);

  it('leaves a box within the page untouched', () => {
    const grown = box(500, 100, 240, 120);

    expect(boundTransformerBoxToPageKeepingRatio(old, grown, PAGE)).toEqual(grown);
  });

  it('scales the box down about its top left corner when the bottom right anchor leaves the page', () => {
    // The right edge would land at 900, 100 past the page. Only 300 is
    // available from x = 500, so the box becomes 300 x 150.
    const bounded = boundTransformerBoxToPageKeepingRatio(old, box(500, 100, 400, 200), PAGE);

    expect(bounded.x).toBeCloseTo(500);
    expect(bounded.y).toBeCloseTo(100);
    expect(bounded.width).toBeCloseTo(300);
    expect(bounded.height).toBeCloseTo(150);
  });

  it('scales the box down about its bottom right corner when the top left anchor leaves the page', () => {
    // The top left anchor is dragged to (-100, -200) with the bottom right
    // fixed at (700, 200). 700 is available horizontally and 200 vertically,
    // so the height binds: 200 tall, 400 wide, pinned to the fixed corner.
    const bounded = boundTransformerBoxToPageKeepingRatio(old, box(-100, -200, 800, 400), PAGE);

    expect(bounded.x).toBeCloseTo(300);
    expect(bounded.y).toBeCloseTo(0);
    expect(bounded.width).toBeCloseTo(400);
    expect(bounded.height).toBeCloseTo(200);
  });

  it('binds on whichever axis has less room', () => {
    // From (500, 100) there is 300 horizontally and 900 vertically. A 1:1
    // box of 500 is limited by the width.
    const square = box(500, 100, 100, 100);

    const bounded = boundTransformerBoxToPageKeepingRatio(square, box(500, 100, 500, 500), PAGE);

    expect(bounded.width).toBeCloseTo(300);
    expect(bounded.height).toBeCloseTo(300);
  });

  it('keeps every corner of a rotated box on the page while preserving the ratio', () => {
    const rotation = Math.PI / 4;
    const old = box(500, 300, 200, 100, rotation);
    const proposed = box(500, 300, 800, 400, rotation);

    const bounded = boundTransformerBoxToPageKeepingRatio(old, proposed, PAGE);

    expectOnPage(bounded);
    expect(bounded.rotation).toBe(rotation);
    expect(bounded.width / bounded.height).toBeCloseTo(2);
    expectCornerClose(cornersOf(bounded)[0], cornersOf(proposed)[0]);
    expect(bounded.width).toBeLessThan(proposed.width);
  });
});
