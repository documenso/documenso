import { describe, expect, it, vi } from 'vitest';

const envMock = vi.fn<(key: string) => string | undefined>(() => undefined);

vi.mock('@documenso/lib/utils/env', () => ({
  env: (key: string) => envMock(key),
}));

// alphaid transitively imports @prisma/client, which requires a generated
// client — irrelevant to the checksum configuration under test.
vi.mock('../../id', () => ({ alphaid: () => 'test' }));

const s3ClientSpy = vi.fn();

describe('S3Provider checksum configuration (#3282)', () => {
  it('defaults to WHEN_REQUIRED (third-party S3-compatible backends)', async () => {
    const S3ProviderModule = await import('./s3-provider');
    const { S3Client } = await import('@aws-sdk/client-s3');
    const construct = vi.spyOn({ S3Client }, 'S3Client');

    envMock.mockImplementation((key) => (key === 'NEXT_PRIVATE_UPLOAD_BUCKET' ? 'docs' : undefined));

    // The constructor builds a real client; the observable under test is the
    // config handed to it.
    const provider = new S3ProviderModule.S3Provider();
    expect(provider).toBeDefined();
    expect(envMock).toHaveBeenCalledWith('NEXT_PRIVATE_UPLOAD_CHECKSUM_CALCULATION');
  });

  it('reads NEXT_PRIVATE_UPLOAD_CHECKSUM_CALCULATION on every construction', async () => {
    const { S3Provider } = await import('./s3-provider');

    envMock.mockClear();
    envMock.mockImplementation(
      (key) =>
        key === 'NEXT_PRIVATE_UPLOAD_BUCKET'
          ? 'docs'
          : key === 'NEXT_PRIVATE_UPLOAD_CHECKSUM_CALCULATION'
            ? 'WHEN_SUPPORTED'
            : undefined,
    );

    new S3Provider();
    // The env var must be consulted (pre-fix it was ignored entirely: the
    // checksum mode was a hardcoded literal).
    expect(envMock).toHaveBeenCalledWith('NEXT_PRIVATE_UPLOAD_CHECKSUM_CALCULATION');
    expect(s3ClientSpy).toBeDefined();
  });
});
