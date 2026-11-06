import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { getNeonStorageRegion, NeonProvider } from './neon-provider';

const ENDPOINT = 'https://br-cool-darkness-a1b2c3d4.storage.c-7.us-east-2.aws.neon.tech';

describe('getNeonStorageRegion', () => {
  it('reads the region from a branch storage endpoint', () => {
    expect(getNeonStorageRegion(ENDPOINT)).toBe('us-east-2');
    expect(getNeonStorageRegion('https://br-x.storage.c-1.ap-southeast-1.aws.neon.tech')).toBe('ap-southeast-1');
    expect(getNeonStorageRegion('https://br-x.storage.c-12.eu-central-1.aws.neon.tech/')).toBe('eu-central-1');
  });

  it('returns undefined for valid URLs that are not Neon storage endpoints', () => {
    expect(getNeonStorageRegion('http://localhost:9000')).toBeUndefined();
    expect(getNeonStorageRegion('https://s3.us-east-1.amazonaws.com')).toBeUndefined();
  });

  it('throws for endpoints that are not valid URLs', () => {
    expect(() => getNeonStorageRegion('not a url')).toThrow(/not a valid URL: "not a url"/);
    expect(() => getNeonStorageRegion('br-x.storage.c-7.us-east-2.aws.neon.tech')).toThrow(/not a valid URL/);
  });
});

describe('NeonProvider', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PRIVATE_UPLOAD_ENDPOINT', ENDPOINT);
    vi.stubEnv('NEXT_PRIVATE_UPLOAD_BUCKET', 'documenso');
    vi.stubEnv('NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID', 'nak_live_test');
    vi.stubEnv('NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY', 'nsk_live_test');
    vi.stubEnv('NEXT_PRIVATE_UPLOAD_REGION', '');
    vi.stubEnv('NEXT_PRIVATE_UPLOAD_FORCE_PATH_STYLE', 'false');
    vi.stubEnv('NEXT_PRIVATE_UPLOAD_DISTRIBUTION_DOMAIN', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('requires an endpoint', () => {
    vi.stubEnv('NEXT_PRIVATE_UPLOAD_ENDPOINT', '');

    expect(() => new NeonProvider()).toThrow(/NEXT_PRIVATE_UPLOAD_ENDPOINT/);
  });

  it('rejects an endpoint that is not a valid URL', () => {
    vi.stubEnv('NEXT_PRIVATE_UPLOAD_ENDPOINT', 'br-x.storage.c-7.us-east-2.aws.neon.tech');

    expect(() => new NeonProvider()).toThrow(/not a valid URL/);

    vi.stubEnv('NEXT_PRIVATE_UPLOAD_REGION', 'us-east-2');

    expect(() => new NeonProvider()).toThrow(/not a valid URL/);
  });

  it('signs path-style URLs with the region from the endpoint', async () => {
    const { url, key } = await new NeonProvider().getPresignGetUrl('abc/contract.pdf');
    const signed = new URL(url);

    expect(key).toBe('abc/contract.pdf');
    expect(signed.origin).toBe(ENDPOINT);
    expect(signed.pathname).toBe('/documenso/abc/contract.pdf');
    expect(signed.searchParams.get('X-Amz-Credential')).toMatch(/^nak_live_test\/\d{8}\/us-east-2\/s3\/aws4_request$/);
  });

  it('prefers an explicit region', async () => {
    vi.stubEnv('NEXT_PRIVATE_UPLOAD_REGION', 'eu-central-1');

    const { url } = await new NeonProvider().getPresignGetUrl('abc/contract.pdf');

    expect(new URL(url).searchParams.get('X-Amz-Credential')).toContain('/eu-central-1/s3/');
  });

  it('falls back to us-east-1 for endpoints it cannot read a region from', async () => {
    vi.stubEnv('NEXT_PRIVATE_UPLOAD_ENDPOINT', 'https://storage.example.com');

    const { url } = await new NeonProvider().getPresignGetUrl('abc/contract.pdf');

    expect(new URL(url).searchParams.get('X-Amz-Credential')).toContain('/us-east-1/s3/');
  });

  it('presigns uploads without a checksum so real bodies are accepted', async () => {
    const { url, key } = await new NeonProvider().getPresignPostUrl('My Contract.pdf', 'application/pdf', 42);
    const signed = new URL(url);

    expect(key).toMatch(/^42\/[A-Za-z0-9]{12}\/my-contract\.pdf$/);
    expect(signed.pathname).toBe(`/documenso/${key}`);
    expect(signed.searchParams.get('x-amz-checksum-crc32')).toBeNull();
    expect(signed.searchParams.get('x-amz-sdk-checksum-algorithm')).toBeNull();
  });
});

const isLive = Boolean(process.env.NEON_STORAGE_LIVE_TEST && process.env.NEXT_PRIVATE_UPLOAD_ENDPOINT);

describe.skipIf(!isLive)('NeonProvider (live)', () => {
  const pdf = Buffer.from('%PDF-1.4\n% documenso neon storage test\n%%EOF\n');

  it('uploads, downloads and deletes through the provider', async () => {
    const provider = new NeonProvider();

    const { key } = await provider.uploadFile({ name: 'live test.pdf', type: 'application/pdf', body: pdf });
    expect(key).toMatch(/^[A-Za-z0-9]{12}\/live-test\.pdf$/);

    const { url: getUrl } = await provider.getPresignGetUrl(key);
    const downloaded = await fetch(getUrl);
    expect(downloaded.status).toBe(200);
    expect(downloaded.headers.get('content-type')).toBe('application/pdf');
    expect(Buffer.from(await downloaded.arrayBuffer()).equals(pdf)).toBe(true);

    await provider.deleteFile(key);

    const afterDelete = await fetch((await provider.getPresignGetUrl(key)).url);
    expect(afterDelete.status).toBe(404);
  });

  it('accepts uploads to presigned PUT URLs', async () => {
    const provider = new NeonProvider();

    const { url, key } = await provider.getPresignPostUrl('presigned.pdf', 'application/pdf');
    const uploaded = await fetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/pdf' }, body: pdf });
    expect(uploaded.status).toBe(200);

    const { url: absoluteUrl } = await provider.getAbsolutePresignPostUrl(key);
    const replaced = await fetch(absoluteUrl, { method: 'PUT', body: pdf });
    expect(replaced.status).toBe(200);

    const downloaded = await fetch((await provider.getPresignGetUrl(key)).url);
    expect(Buffer.from(await downloaded.arrayBuffer()).equals(pdf)).toBe(true);

    await provider.deleteFile(key);
  });
});
