import { describe, expect, it } from 'vitest';

import {
  getQuotaUsagePercent,
  getQuotaWarningCount,
  isQuotaExceeded,
  isQuotaNearing,
  normalizeCapacityLimit,
} from './quota-usage';

describe('isQuotaExceeded', () => {
  it('treats null quota as unlimited (never exceeded)', () => {
    expect(isQuotaExceeded(null, 0)).toBe(false);
    expect(isQuotaExceeded(null, 1_000_000)).toBe(false);
  });

  it('treats a zero quota as blocked (always exceeded)', () => {
    expect(isQuotaExceeded(0, 0)).toBe(true);
    expect(isQuotaExceeded(0, 5)).toBe(true);
  });

  it('is exceeded once usage reaches the quota (>= boundary)', () => {
    expect(isQuotaExceeded(10, 9)).toBe(false);
    expect(isQuotaExceeded(10, 10)).toBe(true);
    expect(isQuotaExceeded(10, 11)).toBe(true);
  });
});

describe('getQuotaWarningCount', () => {
  it('rounds the 80% threshold up', () => {
    expect(getQuotaWarningCount(10)).toBe(8);
    expect(getQuotaWarningCount(100)).toBe(80);
    // 5 * 0.8 = 4 exactly.
    expect(getQuotaWarningCount(5)).toBe(4);
    // 3 * 0.8 = 2.4 -> 3, so the warning count equals the quota itself.
    expect(getQuotaWarningCount(3)).toBe(3);
  });
});

describe('isQuotaNearing', () => {
  it('is never nearing for unlimited or blocked quotas', () => {
    expect(isQuotaNearing(null, 5)).toBe(false);
    expect(isQuotaNearing(0, 5)).toBe(false);
  });

  it('is nearing from the warning threshold up to (but not including) the quota', () => {
    expect(isQuotaNearing(10, 7)).toBe(false);
    expect(isQuotaNearing(10, 8)).toBe(true);
    expect(isQuotaNearing(10, 9)).toBe(true);
  });

  it('is not nearing once exceeded (nearing and exceeded are mutually exclusive)', () => {
    expect(isQuotaNearing(10, 10)).toBe(false);
    expect(isQuotaNearing(10, 11)).toBe(false);
  });

  it('can never fire for tiny quotas where the warning count equals the quota', () => {
    // getQuotaWarningCount(3) === 3, so usage >= 3 is already exceeded.
    expect(isQuotaNearing(3, 2)).toBe(false);
    expect(isQuotaNearing(3, 3)).toBe(false);
  });

  it('agrees with the warning-count helper at the boundary', () => {
    const quota = 250;
    const warningCount = getQuotaWarningCount(quota);

    expect(isQuotaNearing(quota, warningCount - 1)).toBe(false);
    expect(isQuotaNearing(quota, warningCount)).toBe(true);
  });
});

describe('getQuotaUsagePercent', () => {
  it('returns 0 for unlimited or non-positive quotas', () => {
    expect(getQuotaUsagePercent(5, null)).toBe(0);
    expect(getQuotaUsagePercent(5, 0)).toBe(0);
    expect(getQuotaUsagePercent(5, -10)).toBe(0);
  });

  it('rounds the percentage to the nearest integer', () => {
    expect(getQuotaUsagePercent(1, 3)).toBe(33);
    expect(getQuotaUsagePercent(2, 3)).toBe(67);
    expect(getQuotaUsagePercent(50, 100)).toBe(50);
  });

  it('clamps the percentage to 100 when usage exceeds the quota', () => {
    expect(getQuotaUsagePercent(150, 100)).toBe(100);
  });
});

describe('normalizeCapacityLimit', () => {
  it('maps 0 (unlimited for capacity limits) to null', () => {
    expect(normalizeCapacityLimit(0)).toBeNull();
  });

  it('passes positive limits through unchanged', () => {
    expect(normalizeCapacityLimit(1)).toBe(1);
    expect(normalizeCapacityLimit(25)).toBe(25);
  });
});
