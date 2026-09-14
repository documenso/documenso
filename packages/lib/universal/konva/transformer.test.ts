import { describe, expect, it } from 'vitest';

import { boundTransformerBoxToPage } from './transformer';

const PAGE = { width: 800, height: 1000 };

const box = (x: number, y: number, width: number, height: number, rotation = 0) => ({
  x,
  y,
  width,
  height,
  rotation,
});

describe('boundTransformerBoxToPage', () => {
  it('leaves a box within the page untouched', () => {
    const inside = box(100, 100, 200, 150);

    expect(boundTransformerBoxToPage(inside, PAGE)).toEqual(inside);
  });

  it('pins the right edge to the page while a right anchor is dragged past it', () => {
    // Dragging the right edge from 700 to 900 stops at the page edge.
    const bounded = boundTransformerBoxToPage(box(500, 100, 400, 150), PAGE);

    expect(bounded).toEqual(box(500, 100, 300, 150));
  });

  it('pins the bottom edge to the page', () => {
    const bounded = boundTransformerBoxToPage(box(100, 900, 200, 300), PAGE);

    expect(bounded).toEqual(box(100, 900, 200, 100));
  });

  it('pins the left edge to the page, keeping the right edge where it was', () => {
    // Dragging the left anchor to x = -50 pins it at 0 and shrinks the width
    // so the opposite edge stays put at 250.
    const bounded = boundTransformerBoxToPage(box(-50, 100, 300, 150), PAGE);

    expect(bounded).toEqual(box(0, 100, 250, 150));
  });

  it('pins the top edge to the page, keeping the bottom edge where it was', () => {
    const bounded = boundTransformerBoxToPage(box(100, -30, 200, 180), PAGE);

    expect(bounded).toEqual(box(100, 0, 200, 150));
  });

  it('pins the axes independently, so the other axis still follows the mouse', () => {
    // Only the width overflows; the height change is kept as is.
    const bounded = boundTransformerBoxToPage(box(600, 100, 300, 400), PAGE);

    expect(bounded).toEqual(box(600, 100, 200, 400));
  });

  it('does not bound rotated boxes, whose edges are not axis aligned', () => {
    const rotated = box(700, 100, 300, 150, 45);

    expect(boundTransformerBoxToPage(rotated, PAGE)).toEqual(rotated);
  });
});
