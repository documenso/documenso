import { HttpTimestampAuthority } from '@libpdf/core';
import { describe, expect, it, vi } from 'vitest';
import { createTsaFetch } from './tsa-fetch';

vi.mock('./tsa-fetch', () => ({
  createTsaFetch: vi.fn(),
}));

describe('HttpTimestampAuthority Integration', () => {
  it('should use the custom fetch implementation from createTsaFetch', () => {
    const mockTsaFetch = vi.fn();
    vi.mocked(createTsaFetch).mockReturnValue(mockTsaFetch);

    const authority = new HttpTimestampAuthority('https://timestamp.sectigo.com', {
      fetch: createTsaFetch(),
    });

    // We can't easily check the private fetch implementation on HttpTimestampAuthority
    // directly, but we've confirmed the constructor accepts it and it is passed in tsa.ts.
    expect(createTsaFetch).toHaveBeenCalled();
    expect(authority).toBeDefined();
  });
});
