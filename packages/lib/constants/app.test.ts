import { afterEach, describe, expect, it, vi } from 'vitest';

import { NEXT_PRIVATE_SIGNING_REASON } from './app';

describe('NEXT_PRIVATE_SIGNING_REASON', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the Documenso signing reason', () => {
    vi.stubEnv('NEXT_PRIVATE_SIGNING_REASON', undefined);

    expect(NEXT_PRIVATE_SIGNING_REASON()).toBe('Signed by Documenso');
  });

  it('uses the configured signing reason verbatim', () => {
    vi.stubEnv('NEXT_PRIVATE_SIGNING_REASON', 'Signed by Objective');

    expect(NEXT_PRIVATE_SIGNING_REASON()).toBe('Signed by Objective');
  });
});
