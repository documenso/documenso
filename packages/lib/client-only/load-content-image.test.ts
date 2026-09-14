import { describe, expect, it } from 'vitest';

import { loadContentImage, parseContentDispositionFileName } from './load-content-image';

const IMAGE = { width: 1, height: 1 } as unknown as ImageBitmap;

const BYTES = 'some image bytes';

/**
 * A fetch which answers with the given statuses in order, recording calls.
 */
const createFetch = (statuses: number[], headers: Record<string, string> = {}) => {
  const calls: string[] = [];

  const fetch = (url: string) => {
    calls.push(url);

    const status = statuses[Math.min(calls.length, statuses.length) - 1];

    return Promise.resolve(new Response(status === 200 ? new Blob([BYTES]) : null, { status, headers }));
  };

  return { fetch, calls };
};

const createImageBitmap = async () => IMAGE;

describe('parseContentDispositionFileName', () => {
  it('reads a quoted file name', () => {
    expect(parseContentDispositionFileName('inline; filename="logo.png"')).toBe('logo.png');
  });

  it('prefers the encoded file name, decoding it', () => {
    expect(
      parseContentDispositionFileName(`inline; filename="fallback.png"; filename*=UTF-8''caf%C3%A9%20logo.png`),
    ).toBe('café logo.png');
  });

  it('returns null when there is no file name', () => {
    expect(parseContentDispositionFileName('inline')).toBeNull();
    expect(parseContentDispositionFileName(null)).toBeNull();
  });
});

describe('loadContentImage', () => {
  it('decodes the fetched bytes into an image with its details', async () => {
    const { fetch, calls } = createFetch([200], { 'Content-Disposition': 'inline; filename="logo.png"' });

    const loaded = await loadContentImage('https://example.com/image', { fetch, createImageBitmap });

    expect(loaded.image).toBe(IMAGE);
    expect(loaded.details).toEqual({ fileName: 'logo.png', fileSize: BYTES.length });
    expect(calls).toEqual(['https://example.com/image']);
  });

  it('has no file name when the header is unavailable, e.g. cross origin', async () => {
    const { fetch } = createFetch([200]);

    const loaded = await loadContentImage('https://example.com/image', { fetch, createImageBitmap });

    expect(loaded.details).toEqual({ fileName: null, fileSize: BYTES.length });
  });

  it('retries once after a server error', async () => {
    const { fetch, calls } = createFetch([503, 200]);

    const loaded = await loadContentImage('https://example.com/image', { fetch, createImageBitmap });

    expect(loaded.image).toBe(IMAGE);
    expect(calls).toHaveLength(2);
  });

  it('retries once after a network error', async () => {
    let attempts = 0;

    const fetch = () => {
      attempts += 1;

      if (attempts === 1) {
        return Promise.reject(new TypeError('Failed to fetch'));
      }

      return Promise.resolve(new Response(new Blob([BYTES]), { status: 200 }));
    };

    const loaded = await loadContentImage('https://example.com/image', { fetch, createImageBitmap });

    expect(loaded.image).toBe(IMAGE);
    expect(attempts).toBe(2);
  });

  it('fails without retrying when the image is not found', async () => {
    const { fetch, calls } = createFetch([404]);

    await expect(loadContentImage('https://example.com/image', { fetch, createImageBitmap })).rejects.toThrow('404');

    expect(calls).toHaveLength(1);
  });

  it('fails after the retry is exhausted', async () => {
    const { fetch, calls } = createFetch([500, 500]);

    await expect(loadContentImage('https://example.com/image', { fetch, createImageBitmap })).rejects.toThrow('500');

    expect(calls).toHaveLength(2);
  });
});
