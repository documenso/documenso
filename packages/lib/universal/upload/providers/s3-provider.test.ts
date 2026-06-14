import type { S3Client } from '@aws-sdk/client-s3';
import { describe, expect, it } from 'vitest';

import { S3Provider } from './s3-provider';

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
  const getClientConfig = (provider: S3Provider) => {
    // The client is private; reach into it to assert how it was constructed.
    return (provider as unknown as { client: S3Client }).client.config;
  };

  it('only sends request checksums when required', async () => {
    const config = getClientConfig(new S3Provider());

    const requestChecksumCalculation = await config.requestChecksumCalculation();

    expect(requestChecksumCalculation).toBe('WHEN_REQUIRED');
  });

  it('only validates response checksums when required', async () => {
    const config = getClientConfig(new S3Provider());

    const responseChecksumValidation = await config.responseChecksumValidation();

    expect(responseChecksumValidation).toBe('WHEN_REQUIRED');
  });
});
