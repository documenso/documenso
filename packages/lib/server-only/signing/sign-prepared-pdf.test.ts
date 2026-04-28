import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@documenso/signing', () => ({
  signPdf: vi.fn(),
}));

import { signPdf } from '@documenso/signing';

import { signPreparedPdf } from './sign-prepared-pdf';

type FakePdf = {
  save: ReturnType<typeof vi.fn>;
};

const createFakePdf = (bytes: Uint8Array): FakePdf => ({
  save: vi.fn().mockResolvedValue(bytes),
});

describe('signPreparedPdf', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should send the prepared PDF to the configured HTTP signing endpoint', async () => {
    process.env.NEXT_PRIVATE_SIGNING_TRANSPORT = 'http';
    process.env.NEXT_PRIVATE_SIGNING_HTTP_URL = 'http://127.0.0.1:8000/api/sign/pdf';
    process.env.NEXT_PRIVATE_SIGNING_HTTP_AUTH_TOKEN = 'bridge-secret';
    process.env.NEXT_PRIVATE_SIGNING_HTTP_AUTH_HEADER = 'X-API-Key';
    process.env.NEXT_PRIVATE_SIGNING_HTTP_FORM_FIELD_NAME = 'file';
    process.env.NEXT_PRIVATE_SIGNING_HTTP_TIMEOUT_MS = '1234';

    const unsignedPdfBytes = Uint8Array.from([1, 2, 3, 4]);
    const signedPdfBytes = Uint8Array.from([9, 8, 7, 6]);
    const fakePdf = createFakePdf(unsignedPdfBytes);

    const fetchMock = vi.fn().mockResolvedValue(
      new Response(signedPdfBytes, {
        status: 200,
        headers: { 'content-type': 'application/pdf' },
      }),
    );

    vi.stubGlobal('fetch', fetchMock);

    const result = await signPreparedPdf({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      pdf: fakePdf as unknown as never,
      fileName: 'document.pdf',
    });

    expect(result).toEqual(signedPdfBytes);
    expect(fakePdf.save).toHaveBeenCalledWith({ useXRefStream: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toBe('http://127.0.0.1:8000/api/sign/pdf');
    expect(init).toBeDefined();

    if (!init) {
      expect.unreachable('expected fetch init to be defined');
    }

    expect(init.method).toBe('POST');
    expect(init.headers).toBeInstanceOf(Headers);
    expect(new Headers(init.headers).get('X-API-Key')).toBe('bridge-secret');

    expect(init.body).toBeInstanceOf(FormData);

    const body = init.body;

    if (!(body instanceof FormData)) {
      expect.unreachable('expected request body to be FormData');
    }

    const uploadedFile = body.get('file');

    expect(uploadedFile).toBeInstanceOf(File);

    if (!(uploadedFile instanceof File)) {
      expect.unreachable('expected uploaded file to be a File');
    }

    expect(uploadedFile.name).toBe('document.pdf');
    expect(new Uint8Array(await uploadedFile.arrayBuffer())).toEqual(unsignedPdfBytes);
  });

  it('should throw when HTTP signing fails', async () => {
    process.env.NEXT_PRIVATE_SIGNING_TRANSPORT = 'http';
    process.env.NEXT_PRIVATE_SIGNING_HTTP_URL = 'http://127.0.0.1:8000/api/sign/pdf';

    const fakePdf = createFakePdf(Uint8Array.from([1, 2, 3]));

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('upstream exploded', {
          status: 502,
          headers: { 'content-type': 'text/plain' },
        }),
      ),
    );

    await expect(
      signPreparedPdf({
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        pdf: fakePdf as unknown as never,
        fileName: 'document.pdf',
      }),
    ).rejects.toThrow('HTTP signing failed with status 502');
  });

  it('should fall back to the built-in signer when transport is not http', async () => {
    process.env.NEXT_PRIVATE_SIGNING_TRANSPORT = 'local';

    const signedPdfBytes = Uint8Array.from([5, 4, 3, 2]);
    const fakePdf = createFakePdf(Uint8Array.from([1, 2, 3]));

    vi.mocked(signPdf).mockResolvedValue(signedPdfBytes);

    const result = await signPreparedPdf({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      pdf: fakePdf as unknown as never,
      fileName: 'document.pdf',
    });

    expect(result).toEqual(signedPdfBytes);
    expect(signPdf).toHaveBeenCalledWith({
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      pdf: fakePdf as unknown as never,
    });
    expect(fakePdf.save).not.toHaveBeenCalled();
  });
});
