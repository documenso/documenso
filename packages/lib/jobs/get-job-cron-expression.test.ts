import { afterEach, describe, expect, it } from 'vitest';

import { getJobCronExpression } from './get-job-cron-expression';

const ENV_KEY = 'NEXT_PRIVATE_JOBS_TEST_CRON';
const ORIGINAL_VALUE = process.env[ENV_KEY];

afterEach(() => {
  if (ORIGINAL_VALUE === undefined) {
    delete process.env[ENV_KEY];
  } else {
    process.env[ENV_KEY] = ORIGINAL_VALUE;
  }
});

describe('getJobCronExpression', () => {
  it('returns the fallback cron expression when the env var is not set', () => {
    delete process.env[ENV_KEY];

    expect(getJobCronExpression(ENV_KEY, '*/15 * * * *')).toBe('*/15 * * * *');
  });

  it('returns the configured cron expression when the env var is set', () => {
    process.env[ENV_KEY] = '0 * * * *';

    expect(getJobCronExpression(ENV_KEY, '*/15 * * * *')).toBe('0 * * * *');
  });

  it('returns the fallback cron expression when the env var is empty', () => {
    process.env[ENV_KEY] = '';

    expect(getJobCronExpression(ENV_KEY, '*/15 * * * *')).toBe('*/15 * * * *');
  });

  it('throws when the configured cron expression is invalid', () => {
    process.env[ENV_KEY] = 'not a cron expression';

    expect(() => getJobCronExpression(ENV_KEY, '*/15 * * * *')).toThrow(`Invalid cron expression for ${ENV_KEY}`);
  });
});
