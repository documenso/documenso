import type { S3ClientConfig } from '@aws-sdk/client-s3';
import { S3Client } from '@aws-sdk/client-s3';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { S3Provider } from './s3-provider';

vi.mock('@aws-sdk/client-s3', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@aws-sdk/client-s3')>()),
  S3Client: vi.fn(),
}));

const S3ClientMock = vi.mocked(S3Client);

/**
 * Regression test for the `InvalidDigest` failures reported against
 * S3-compatible storage providers (GarageHQ, MinIO, Backblaze B2, ...).
 *
 * Since `@aws-sdk/client-s3` v3.729 the SDK adds a CRC32 checksum to every
 * request by default (`requestChecksumCalculation: 'WHEN_SUPPORTED'`), which
 * those backends reject. The provider must opt into `'WHEN_REQUIRED'` so the
 * default configuration keeps working with non-AWS object storage.
 */
describe('S3Provider', () => {
  beforeEach(() => {
    S3ClientMock.mockClear();
  });

  const getConstructedConfig = (): S3ClientConfig => {
    new S3Provider();

    expect(S3ClientMock).toHaveBeenCalledTimes(1);

    return S3ClientMock.mock.calls[0][0] ?? {};
  };

  it.each([
    ['requestChecksumCalculation'],
    ['responseChecksumValidation'],
  ] as const)('constructs the S3 client with %s set to WHEN_REQUIRED', async (configKey) => {
    const config = getConstructedConfig();

    const value = config[configKey];

    // The option can be supplied either as a literal or as a (sync/async)
    // provider that resolves to it; resolve it before asserting.
    const resolved = typeof value === 'function' ? await value() : value;

    expect(resolved).toBe('WHEN_REQUIRED');
  });
});
