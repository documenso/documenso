import { describe, expect, it } from 'vitest';

import { buildClientAuthenticationHeader } from './exchange-authorization-code';

const decodeCredentials = (header: string) => Buffer.from(header.replace('Basic ', ''), 'base64').toString('utf8');

const basicHeader = (credentials: string) => `Basic ${Buffer.from(credentials, 'utf8').toString('base64')}`;

describe('buildClientAuthenticationHeader', () => {
  it('form-encodes a client ID containing a colon so the Basic auth server does not truncate it', () => {
    const header = buildClientAuthenticationHeader('org:example:documenso', 'secret');

    expect(header).toBe(basicHeader('org%3Aexample%3Adocumenso:secret'));
    expect(decodeCredentials(header).split(':').shift()).toBe('org%3Aexample%3Adocumenso');
  });

  it('leaves credentials without reserved characters identical to the previous encoding', () => {
    expect(buildClientAuthenticationHeader('documenso', 's3cr3t')).toBe(basicHeader('documenso:s3cr3t'));
  });

  it('encodes reserved characters per application/x-www-form-urlencoded', () => {
    const header = buildClientAuthenticationHeader('client id', 'a+b&c=d%');

    expect(header).toBe(basicHeader('client+id:a%2Bb%26c%3Dd%25'));
    expect(decodeCredentials(header)).toBe('client+id:a%2Bb%26c%3Dd%25');
  });
});
