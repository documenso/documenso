import { describe, expect, it } from 'vitest';

import {
  calculateContainFit,
  calculateContentBoxGeometry,
  calculateContentLineGeometry,
  hexToRgba,
  resolveContentStrokeDash,
} from './content-renderer';

const PAGE_WIDTH = 800;
const PAGE_HEIGHT = 1000;

describe('calculateContentBoxGeometry', () => {
  it('converts percentage based geometry to pixels', () => {
    const geometry = calculateContentBoxGeometry(
      {
        positionX: 10,
        positionY: 20,
        width: 50,
        height: 25,
      },
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    expect(geometry).toEqual({
      x: 80,
      y: 200,
      width: 400,
      height: 250,
    });
  });

  it('defaults missing geometry values to zero', () => {
    const geometry = calculateContentBoxGeometry({}, PAGE_WIDTH, PAGE_HEIGHT);

    expect(geometry).toEqual({
      x: 0,
      y: 0,
      width: 0,
      height: 0,
    });
  });
});

describe('calculateContentLineGeometry', () => {
  it('positions the group at the top left of the line bounds', () => {
    const geometry = calculateContentLineGeometry(
      {
        startXPosition: 10,
        endXPosition: 50,
        startYPosition: 20,
        endYPosition: 20,
      },
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    expect(geometry.x).toBe(80);
    expect(geometry.y).toBe(200);
    expect(geometry.points).toEqual([0, 0, 320, 0]);
  });

  it('normalizes lines drawn from right to left', () => {
    const geometry = calculateContentLineGeometry(
      {
        startXPosition: 50,
        endXPosition: 10,
        startYPosition: 40,
        endYPosition: 20,
      },
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    // Group sits at the top left of the bounds regardless of direction.
    expect(geometry.x).toBe(80);
    expect(geometry.y).toBe(200);

    // Points preserve the original start -> end direction relative to the group.
    expect(geometry.points).toEqual([320, 200, 0, 0]);
  });

  it('defaults missing coordinates to zero', () => {
    const geometry = calculateContentLineGeometry({}, PAGE_WIDTH, PAGE_HEIGHT);

    expect(geometry).toEqual({
      x: 0,
      y: 0,
      points: [0, 0, 0, 0],
    });
  });
});

describe('calculateContainFit', () => {
  it('fits a wide image to the box width and centers it vertically', () => {
    const fit = calculateContainFit({ width: 200, height: 100 }, { width: 100, height: 100 });

    expect(fit).toEqual({ x: 0, y: 25, width: 100, height: 50 });
  });

  it('fits a tall image to the box height and centers it horizontally', () => {
    const fit = calculateContainFit({ width: 100, height: 200 }, { width: 100, height: 100 });

    expect(fit).toEqual({ x: 25, y: 0, width: 50, height: 100 });
  });

  it('enlarges small images to fill the box', () => {
    const fit = calculateContainFit({ width: 10, height: 10 }, { width: 100, height: 60 });

    expect(fit).toEqual({ x: 20, y: 0, width: 60, height: 60 });
  });

  it('returns an empty fit for a degenerate image or box', () => {
    const empty = { x: 0, y: 0, width: 0, height: 0 };

    expect(calculateContainFit({ width: 0, height: 0 }, { width: 100, height: 100 })).toEqual(empty);
    expect(calculateContainFit({ width: 100, height: 100 }, { width: 0, height: 50 })).toEqual(empty);
  });
});

describe('hexToRgba', () => {
  it('converts 6 digit hex colors', () => {
    expect(hexToRgba('#ff0000', 1)).toBe('rgba(255, 0, 0, 1)');
    expect(hexToRgba('#00FF80', 0.5)).toBe('rgba(0, 255, 128, 0.5)');
  });

  it('expands 3 digit hex colors', () => {
    expect(hexToRgba('#abc', 1)).toBe('rgba(170, 187, 204, 1)');
  });

  it('clamps alpha to the valid range', () => {
    expect(hexToRgba('#000000', 2)).toBe('rgba(0, 0, 0, 1)');
    expect(hexToRgba('#000000', -1)).toBe('rgba(0, 0, 0, 0)');
  });
});

describe('resolveContentStrokeDash', () => {
  it('returns no dash for solid strokes', () => {
    expect(resolveContentStrokeDash('solid', 2)).toEqual([]);
  });

  it('scales dash patterns by the stroke width', () => {
    expect(resolveContentStrokeDash('dashed', 2)).toEqual([8, 6]);
    expect(resolveContentStrokeDash('dotted', 2)).toEqual([2, 4]);
  });
});
