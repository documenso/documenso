import { afterEach, describe, expect, it, vi } from 'vitest';

import { getLocalSigningCertificateDefaultPath } from './signing';

describe('getLocalSigningCertificateDefaultPath', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('resolves to the canonical production mount in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    expect(getLocalSigningCertificateDefaultPath()).toBe('/opt/documenso/cert.p12');
  });

  it('resolves to the bundled example certificate outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');

    expect(getLocalSigningCertificateDefaultPath()).toBe('./example/cert.p12');
  });
});
