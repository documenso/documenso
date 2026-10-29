import { describe, expect, it } from 'vitest';

import {
  EnvelopeContentType,
  normalizeContentRotation,
  ZContentColorSchema,
  ZEnvelopeContentMetaSchema,
} from './envelope-content-meta';

const textBox = {
  type: EnvelopeContentType.TEXT,
  page: 1,
  positionX: 10,
  positionY: 10,
  width: 20,
  height: 10,
};

const parse = (meta: unknown) => ZEnvelopeContentMetaSchema.safeParse(meta);

const parsed = (meta: unknown) => ZEnvelopeContentMetaSchema.parse(meta);

describe('ZEnvelopeContentMetaSchema', () => {
  describe('numeric precision', () => {
    it('accepts geometry at up to five decimal places', () => {
      expect(parse({ ...textBox, positionX: 10.12345, width: 20.5, height: 9 }).success).toBe(true);
    });

    it('rejects geometry with more than five decimal places', () => {
      expect(parse({ ...textBox, positionX: 10.123456 }).success).toBe(false);
      expect(parse({ ...textBox, width: 20.000005 }).success).toBe(false);

      // Including the float noise the canvas produces, which the editor is
      // expected to round away before saving.
      expect(parse({ ...textBox, positionX: 33.300000000000004 }).success).toBe(false);
    });

    it('applies the same limit to every other float setting', () => {
      expect(parse({ ...textBox, fontSize: 8.12345, lineHeight: 1.25, letterSpacing: 0.5 }).success).toBe(true);
      expect(parse({ ...textBox, fontSize: 8.123456 }).success).toBe(false);
      expect(parse({ ...textBox, lineHeight: 1.234567 }).success).toBe(false);

      const shape = {
        type: EnvelopeContentType.SHAPE,
        shape: 'rectangle',
        page: 1,
        positionX: 0,
        positionY: 0,
        width: 10,
        height: 10,
      };

      expect(parse({ ...shape, rotation: 12.34567, strokeWidth: 2, fillOpacity: 0.12345 }).success).toBe(true);
      expect(parse({ ...shape, rotation: 12.345678 }).success).toBe(false);
      expect(parse({ ...shape, strokeWidth: 1.999999 }).success).toBe(false);
      expect(parse({ ...shape, fillOpacity: 0.1234567 }).success).toBe(false);
    });

    it('rejects denormals, which have far more than five decimal places', () => {
      expect(parse({ ...textBox, positionY: 1e-300 }).success).toBe(false);
    });

    it('rejects non finite numbers', () => {
      expect(parse({ ...textBox, positionX: Number.NaN }).success).toBe(false);
      expect(parse({ ...textBox, positionX: Number.POSITIVE_INFINITY }).success).toBe(false);
    });
  });

  describe('box placement', () => {
    it('rejects a box with no width or height', () => {
      expect(parse({ ...textBox, width: 0 }).success).toBe(false);
      expect(parse({ ...textBox, height: 0 }).success).toBe(false);

      // One step is the smallest size.
      expect(parse({ ...textBox, width: 0.00001 }).success).toBe(true);
    });

    it('rejects a box which runs past the right or bottom of the page', () => {
      expect(parse({ ...textBox, positionX: 95, width: 10 }).success).toBe(false);
      expect(parse({ ...textBox, positionY: 95, height: 10 }).success).toBe(false);

      // Exactly touching the edge is fine.
      expect(parse({ ...textBox, positionX: 90, width: 10 }).success).toBe(true);
    });

    it('reports the overflow on the axis which overflows', () => {
      const horizontal = parse({ ...textBox, positionX: 95, width: 10 });
      const vertical = parse({ ...textBox, positionY: 95, height: 10 });
      const both = parse({ ...textBox, positionX: 95, width: 10, positionY: 95, height: 10 });

      expect(horizontal.success).toBe(false);
      expect(vertical.success).toBe(false);
      expect(both.success).toBe(false);

      if (horizontal.success || vertical.success || both.success) {
        return;
      }

      expect(horizontal.error.issues.map((issue) => issue.path)).toEqual([['width']]);
      expect(vertical.error.issues.map((issue) => issue.path)).toEqual([['height']]);
      expect(both.error.issues.map((issue) => issue.path)).toEqual([['width'], ['height']]);
    });

    it('does not apply the box check to lines, which have no box', () => {
      const line = parse({ type: EnvelopeContentType.LINE, page: 1, x1: 0, y1: 0, x2: 100, y2: 100 });

      expect(line.success).toBe(true);
    });
  });

  describe('text', () => {
    it('strips control characters, lone surrogates and bidi overrides', () => {
      const meta = parsed({ ...textBox, text: 'a\u0000b\u001fc\u007fd\u202Ee\uD800f\u2066g' });

      expect(meta).toMatchObject({ text: 'abcdefg' });
    });

    it('keeps tabs and newlines, normalising line endings', () => {
      const meta = parsed({ ...textBox, text: 'one\r\ntwo\rthree\tfour\nfive' });

      expect(meta).toMatchObject({ text: 'one\ntwo\nthree\tfour\nfive' });
    });

    it('keeps valid surrogate pairs and other unicode', () => {
      const meta = parsed({ ...textBox, text: 'héllo 👋 日本' });

      expect(meta).toMatchObject({ text: 'héllo 👋 日本' });
    });
  });
});

describe('ZContentColorSchema', () => {
  it('stores colors as lowercase six digit hex', () => {
    expect(ZContentColorSchema.parse('#ABCDEF')).toBe('#abcdef');
    expect(ZContentColorSchema.parse('#F08')).toBe('#ff0088');
    expect(ZContentColorSchema.parse('#abc')).toBe('#aabbcc');
  });

  it('still rejects anything but three or six hex digits', () => {
    expect(ZContentColorSchema.safeParse('#ff000080').success).toBe(false);
    expect(ZContentColorSchema.safeParse('#f008').success).toBe(false);
    expect(ZContentColorSchema.safeParse('red').success).toBe(false);
  });
});

describe('normalizeContentRotation', () => {
  it('rounds to the stored precision', () => {
    expect(normalizeContentRotation(33.300000000000004)).toBe(33.3);
    expect(normalizeContentRotation(-60.00001156757343)).toBe(299.99999);
  });

  it('cannot round up to a full turn', () => {
    expect(normalizeContentRotation(359.999996)).toBe(0);
    expect(normalizeContentRotation(359.999994)).toBe(359.99999);
  });
});
