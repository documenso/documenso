import { describe, expect, it } from 'vitest';

import {
  CONTENT_LINE_META_DEFAULT_VALUES,
  CONTENT_RECTANGLE_META_DEFAULT_VALUES,
  CONTENT_TEXT_META_DEFAULT_VALUES,
  EnvelopeContentShapeType,
  EnvelopeContentType,
  normalizeContentRotation,
} from '../../types/envelope-content-meta';
import type { ContentGroupTransform } from './content-geometry';
import {
  getContentTransformerConfig,
  resolveContentMetaFromTransform,
  resolveLineMetaFromPoints,
} from './content-geometry';

const PAGE_WIDTH = 800;
const PAGE_HEIGHT = 1000;

const createBoxTransform = (overrides: Partial<ContentGroupTransform> = {}): ContentGroupTransform => ({
  x: 80,
  y: 200,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  boxWidth: 400,
  boxHeight: 250,
  linePoints: null,
  ...overrides,
});

describe('normalizeContentRotation', () => {
  it('leaves rotations already in range untouched', () => {
    expect(normalizeContentRotation(0)).toBe(0);
    expect(normalizeContentRotation(90)).toBe(90);
    expect(normalizeContentRotation(359.5)).toBe(359.5);
  });

  it('wraps rotations of a full turn or more', () => {
    expect(normalizeContentRotation(360)).toBe(0);
    expect(normalizeContentRotation(450)).toBe(90);
    expect(normalizeContentRotation(720)).toBe(0);
  });

  it('wraps negative rotations into the positive range', () => {
    expect(normalizeContentRotation(-10)).toBe(350);
    expect(normalizeContentRotation(-360)).toBe(0);
    expect(normalizeContentRotation(-450)).toBe(270);
  });

  it('never returns negative zero', () => {
    // `-360 % 360` is `-0`, which must not leak out since it would serialize
    // and compare in surprising ways.
    expect(Object.is(normalizeContentRotation(-360), -0)).toBe(false);
    expect(Object.is(normalizeContentRotation(-0), -0)).toBe(false);
  });

  it('treats non-finite input as no rotation', () => {
    expect(normalizeContentRotation(Number.NaN)).toBe(0);
    expect(normalizeContentRotation(Number.POSITIVE_INFINITY)).toBe(0);
    expect(normalizeContentRotation(Number.NEGATIVE_INFINITY)).toBe(0);
  });
});

describe('resolveLineMetaFromPoints', () => {
  it('converts the group position and relative points to percentages', () => {
    const meta = resolveLineMetaFromPoints(
      CONTENT_LINE_META_DEFAULT_VALUES,
      80,
      200,
      [0, 0, 320, 100],
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    expect(meta.x1).toBe(10);
    expect(meta.y1).toBe(20);
    expect(meta.x2).toBe(50);
    expect(meta.y2).toBe(30);
  });

  it('preserves the remaining metadata', () => {
    const meta = resolveLineMetaFromPoints(
      { ...CONTENT_LINE_META_DEFAULT_VALUES, strokeWidth: 4, strokeColor: '#ff0000' },
      0,
      0,
      [0, 0, 0, 0],
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    expect(meta.strokeWidth).toBe(4);
    expect(meta.strokeColor).toBe('#ff0000');
  });
});

describe('resolveContentMetaFromTransform', () => {
  it('only updates the position for box drags', () => {
    const original = { ...CONTENT_RECTANGLE_META_DEFAULT_VALUES, width: 10, height: 10, rotation: 45 };

    const meta = resolveContentMetaFromTransform(
      original,
      createBoxTransform({ scaleX: 2, scaleY: 2, rotation: 90 }),
      'drag',
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    expect(meta).toEqual({ ...original, positionX: 10, positionY: 20 });
  });

  it('updates the size and rotation for box transforms using the group scale', () => {
    const meta = resolveContentMetaFromTransform(
      CONTENT_RECTANGLE_META_DEFAULT_VALUES,
      createBoxTransform({ scaleX: 0.5, scaleY: 2, rotation: 450 }),
      'transform',
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    expect(meta.type).toBe(EnvelopeContentType.SHAPE);
    expect(meta).toMatchObject({
      shape: EnvelopeContentShapeType.RECTANGLE,
      positionX: 10,
      positionY: 20,
      width: 25,
      height: 50,
      rotation: 90,
    });
  });

  it('applies to text contents', () => {
    const meta = resolveContentMetaFromTransform(
      CONTENT_TEXT_META_DEFAULT_VALUES,
      createBoxTransform(),
      'transform',
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    expect(meta).toMatchObject({
      type: EnvelopeContentType.TEXT,
      positionX: 10,
      positionY: 20,
      width: 50,
      height: 25,
    });
  });

  it('does not write a rotation onto contents which cannot be rotated', () => {
    const meta = resolveContentMetaFromTransform(
      CONTENT_TEXT_META_DEFAULT_VALUES,
      createBoxTransform({ rotation: 45 }),
      'transform',
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    expect(meta).not.toHaveProperty('rotation');
  });

  it('translates line endpoints for both gestures', () => {
    const transform = createBoxTransform({ boxWidth: 0, boxHeight: 0, linePoints: [0, 0, 320, 0] });

    for (const gesture of ['drag', 'transform'] as const) {
      const meta = resolveContentMetaFromTransform(
        CONTENT_LINE_META_DEFAULT_VALUES,
        transform,
        gesture,
        PAGE_WIDTH,
        PAGE_HEIGHT,
      );

      expect(meta).toMatchObject({
        type: EnvelopeContentType.LINE,
        x1: 10,
        y1: 20,
        x2: 50,
        y2: 20,
      });
    }
  });

  it('returns line metadata unchanged when no line points are present', () => {
    const meta = resolveContentMetaFromTransform(
      CONTENT_LINE_META_DEFAULT_VALUES,
      createBoxTransform(),
      'drag',
      PAGE_WIDTH,
      PAGE_HEIGHT,
    );

    expect(meta).toBe(CONTENT_LINE_META_DEFAULT_VALUES);
  });
});

describe('getContentTransformerConfig', () => {
  it('is move only when any selected content is a line', () => {
    const config = getContentTransformerConfig([EnvelopeContentType.SHAPE, EnvelopeContentType.LINE]);

    expect(config.enabledAnchors).toEqual([]);
    expect(config.rotateEnabled).toBe(false);
  });

  it('only hides the border for a single selected line, which has its own endpoint anchors', () => {
    expect(getContentTransformerConfig([EnvelopeContentType.LINE]).borderEnabled).toBe(false);

    expect(getContentTransformerConfig([EnvelopeContentType.SHAPE, EnvelopeContentType.LINE]).borderEnabled).toBe(true);
    expect(getContentTransformerConfig([EnvelopeContentType.LINE, EnvelopeContentType.LINE]).borderEnabled).toBe(true);
    expect(getContentTransformerConfig([EnvelopeContentType.TEXT]).borderEnabled).toBe(true);
  });

  it('only enables rotation for a single rotatable content', () => {
    expect(getContentTransformerConfig([EnvelopeContentType.IMAGE]).rotateEnabled).toBe(true);
    expect(getContentTransformerConfig([EnvelopeContentType.TEXT]).rotateEnabled).toBe(false);
    expect(getContentTransformerConfig([EnvelopeContentType.IMAGE, EnvelopeContentType.IMAGE]).rotateEnabled).toBe(
      false,
    );
    expect(getContentTransformerConfig([undefined]).rotateEnabled).toBe(false);
  });

  it('keeps resizing enabled for box contents', () => {
    const config = getContentTransformerConfig([EnvelopeContentType.SHAPE, EnvelopeContentType.HIGHLIGHT]);

    expect(config.enabledAnchors.length).toBe(8);
    expect(config.keepRatio).toBe(false);
  });

  it('locks the ratio to the corners for a single image content with an image attached', () => {
    const config = getContentTransformerConfig([EnvelopeContentType.IMAGE], { hasImage: true });

    expect(config.keepRatio).toBe(true);
    expect(config.enabledAnchors).toEqual(['top-left', 'top-right', 'bottom-left', 'bottom-right']);
    expect(config.rotateEnabled).toBe(true);
  });

  it('resizes image placeholders freely until an image is attached', () => {
    const config = getContentTransformerConfig([EnvelopeContentType.IMAGE], { hasImage: false });

    expect(config.keepRatio).toBe(false);
    expect(config.enabledAnchors.length).toBe(8);
  });

  it('does not lock the ratio for multi selections', () => {
    const config = getContentTransformerConfig([EnvelopeContentType.IMAGE, EnvelopeContentType.IMAGE], {
      hasImage: true,
    });

    expect(config.keepRatio).toBe(false);
    expect(config.enabledAnchors.length).toBe(8);
  });
});
