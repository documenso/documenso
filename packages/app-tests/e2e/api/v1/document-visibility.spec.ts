import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe('Document Visibility API V1', () => {
  test('should block access to documents not owned by the user', async ({ request }) => {
    const { user: userA, team: teamA } = await seedUser();
    const { token: tokenA } = await createApiToken({
      userId: userA.id,
      teamId: teamA.id,
      tokenName: 'userA',
      expiresIn: null,
    });

    const { user: userB, team: teamB } = await seedUser();
    const { token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    });

    const documentA = await seedBlankDocument(userA, teamA.id);

    // User A can access their document
    const resA = await request.get(`${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}`, {
      headers: { Authorization: `Bearer ${tokenA}` },
    });

    expect(resA.ok()).toBeTruthy();

    // User B cannot access User A's document
    const resB = await request.get(`${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(resB.ok()).toBeFalsy();
    expect([401, 404]).toContain(resB.status());
  });
});
