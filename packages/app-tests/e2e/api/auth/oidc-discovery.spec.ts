import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';

import { getOpenIdConfiguration } from '@documenso/auth/server/lib/utils/open-id';
import { expect, test } from '@playwright/test';

let server: Server;
let discoveryUrl: string;

test.beforeAll(async () => {
  server = createServer((request, response) => {
    const url = new URL(request.url ?? '/', discoveryUrl);
    const scopes = url.searchParams.get('scopes');

    response.setHeader('Content-Type', 'application/json');
    response.end(
      JSON.stringify({
        authorization_endpoint: `${discoveryUrl}/authorize`,
        token_endpoint: `${discoveryUrl}/token`,
        ...(scopes === null ? {} : { scopes_supported: scopes === '' ? [] : scopes.split(' ') }),
      }),
    );
  });

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });

  discoveryUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

test.afterAll(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }

      resolve();
    });
  });
});

const requiredScopes = ['openid', 'email', 'profile'];

test('accepts discovery metadata that omits the recommended scope list', async () => {
  const config = await getOpenIdConfiguration(discoveryUrl, { requiredScopes });

  expect(config).toEqual({
    authorization_endpoint: `${discoveryUrl}/authorize`,
    token_endpoint: `${discoveryUrl}/token`,
  });
});

test('accepts explicitly advertised scopes that include all requested scopes', async () => {
  const url = new URL(discoveryUrl);
  url.searchParams.set('scopes', requiredScopes.join(' '));

  const config = await getOpenIdConfiguration(url.toString(), { requiredScopes });

  expect(config.scopes_supported).toEqual(requiredScopes);
});

for (const { scopes, unsupported } of [
  { scopes: 'openid email', unsupported: 'profile' },
  { scopes: '', unsupported: 'openid, email, profile' },
]) {
  test(`rejects explicitly advertised scopes missing ${unsupported}`, async () => {
    const url = new URL(discoveryUrl);
    url.searchParams.set('scopes', scopes);

    await expect(getOpenIdConfiguration(url.toString(), { requiredScopes })).rejects.toThrow(
      `Requested scopes not supported by provider: ${unsupported}`,
    );
  });
}
