import { describe, expect, it } from 'vitest';

import { FIVE_DECIMAL_PLACES, roundTo } from './geometry';

describe('roundTo', () => {
  it('rounds to the given decimal places', () => {
    expect(roundTo(1.006, 2)).toBe(1.01);
    expect(roundTo(33.300000000000004, 2)).toBe(33.3);
    expect(roundTo(12.3456, 1)).toBe(12.3);
  });

  it('normalises negative zero', () => {
    expect(Object.is(roundTo(-0, 2), -0)).toBe(false);
    expect(Object.is(roundTo(-0.001, 2), -0)).toBe(false);
  });

  it('flushes denormals to zero', () => {
    expect(roundTo(1e-300, FIVE_DECIMAL_PLACES)).toBe(0);
  });
});
