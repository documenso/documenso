import { describe, expect, it } from 'vitest';

import { createEmbedSignatureKey } from './create-embed-signature-key';

describe('createEmbedSignatureKey', () => {
  const base = {
    organisationId: 'org_123',
    email: 'Ada@Example.com',
    clientUserId: 'usr_8f2c1b4e',
  };

  it('returns a hex SHA-256 digest rather than the raw key', () => {
    const key = createEmbedSignatureKey(base);

    expect(key).toMatch(/^[a-f0-9]{64}$/);
    expect(key).not.toContain(base.organisationId);
    expect(key).not.toContain('example.com');
    expect(key).not.toContain(base.clientUserId);
  });

  it('is stable for the same inputs', () => {
    expect(createEmbedSignatureKey(base)).toBe(createEmbedSignatureKey({ ...base }));
  });

  it('normalises email case and surrounding whitespace', () => {
    const key = createEmbedSignatureKey(base);

    expect(createEmbedSignatureKey({ ...base, email: 'ada@example.com' })).toBe(key);
    expect(createEmbedSignatureKey({ ...base, email: '  ADA@EXAMPLE.COM  ' })).toBe(key);
  });

  it('scopes the key to the organisation', () => {
    expect(createEmbedSignatureKey({ ...base, organisationId: 'org_456' })).not.toBe(createEmbedSignatureKey(base));
  });

  it('scopes the key to the recipient email', () => {
    expect(createEmbedSignatureKey({ ...base, email: 'grace@example.com' })).not.toBe(createEmbedSignatureKey(base));
  });

  it('treats the client user id as case sensitive and opaque', () => {
    expect(createEmbedSignatureKey({ ...base, clientUserId: 'USR_8F2C1B4E' })).not.toBe(createEmbedSignatureKey(base));
  });
});
