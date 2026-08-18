import { afterEach, describe, expect, it, vi } from 'vitest';

import { resolveSweepCron } from './sweep-crons';

describe('resolveSweepCron', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('returns the 15-minute default when the variable is unset or blank', () => {
    expect(resolveSweepCron('NEXT_PRIVATE_JOBS_TEST_SWEEP_CRON', {})).toBe('*/15 * * * *');
    expect(resolveSweepCron('NEXT_PRIVATE_JOBS_TEST_SWEEP_CRON', { NEXT_PRIVATE_JOBS_TEST_SWEEP_CRON: '   ' })).toBe(
      '*/15 * * * *'
    );
  });

  it('returns a valid configured expression unchanged', () => {
    expect(resolveSweepCron('NEXT_PRIVATE_JOBS_TEST_SWEEP_CRON', { NEXT_PRIVATE_JOBS_TEST_SWEEP_CRON: '0 * * * *' })).toBe(
      '0 * * * *'
    );
    expect(
      resolveSweepCron('NEXT_PRIVATE_JOBS_TEST_SWEEP_CRON', { NEXT_PRIVATE_JOBS_TEST_SWEEP_CRON: ' 30 2 * * * ' })
    ).toBe('30 2 * * *');
  });

  it('throws at boot on an invalid cron expression instead of disabling the sweep', () => {
    expect(() =>
      resolveSweepCron('NEXT_PRIVATE_JOBS_TEST_SWEEP_CRON', { NEXT_PRIVATE_JOBS_TEST_SWEEP_CRON: 'not a cron' })
    ).toThrowError(/NEXT_PRIVATE_JOBS_TEST_SWEEP_CRON is not a valid cron expression/);

    expect(() =>
      resolveSweepCron('NEXT_PRIVATE_JOBS_TEST_SWEEP_CRON', { NEXT_PRIVATE_JOBS_TEST_SWEEP_CRON: '*/15 * * *' })
    ).toThrowError(/is not a valid cron expression/);
  });
});
