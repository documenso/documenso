import { afterEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const getProxyForUrlMock = vi.fn();

vi.mock('node-fetch', () => ({
  default: (...args: unknown[]) => fetchMock(...args),
}));

vi.mock('proxy-from-env', () => ({
  getProxyForUrl: (...args: unknown[]) => getProxyForUrlMock(...args),
}));

import { createTsaFetch } from './tsa-fetch';

describe('createTsaFetch', () => {
  afterEach(() => {
    fetchMock.mockReset();
    getProxyForUrlMock.mockReset();
  });

  it('should call fetch without a proxy agent when no proxy is configured', async () => {
    getProxyForUrlMock.mockReturnValue(null);
    fetchMock.mockResolvedValue({ ok: true });

    const tsaFetch = createTsaFetch();

    await tsaFetch('https://timestamp.sectigo.com', { method: 'POST' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://timestamp.sectigo.com',
      expect.objectContaining({
        method: 'POST',
        agent: undefined,
      }),
    );
  });

  it('should attach a proxy agent when a proxy URL is returned', async () => {
    getProxyForUrlMock.mockReturnValue('http://proxy:3128');
    fetchMock.mockResolvedValue({ ok: true });

    const tsaFetch = createTsaFetch();

    await tsaFetch('https://timestamp.sectigo.com');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://timestamp.sectigo.com',
      expect.objectContaining({
        agent: expect.objectContaining({
          proxy: expect.objectContaining({
            href: 'http://proxy:3128/',
          }),
        }),
      }),
    );
  });
});
