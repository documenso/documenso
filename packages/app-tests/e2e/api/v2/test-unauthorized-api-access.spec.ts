import { expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import {
  seedBlankDocument,
  seedCompletedDocument,
  seedDraftDocument,
} from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe('Unauthorized Access - Document API V2', () => {
  let userA: User, teamA: Team, userB: User, teamB: Team, tokenB: string;

  test.beforeEach(async () => {
    ({ user: userA, team: teamA } = await seedUser());

    ({ user: userB, team: teamB } = await seedUser());
    ({ token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    }));
  });

  test('should block unauthorized access to document list endpoint', async ({ request }) => {
    await seedCompletedDocument(userA, teamA.id, ['test@example.com']);

    const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/document`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const data = await res.json();
    expect(data.data.every((doc: { userId: number }) => doc.userId !== userA.id)).toBe(true);
  });

  test('should block unauthorized access to document detail endpoint', async ({ request }) => {
    const doc = await seedBlankDocument(userA, teamA.id);

    const res = await request.get(`${WEBAPP_BASE_URL}/api/v2-beta/document/${doc.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to document update endpoint', async ({ request }) => {
    const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/update`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { documentId: doc.id, data: { title: 'Updated Title' } },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to document delete endpoint', async ({ request }) => {
    const doc = await seedDraftDocument(userA, teamA.id, []);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/delete`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { documentId: doc.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });

  test('should block unauthorized access to document move endpoint', async ({ request }) => {
    const doc = await seedCompletedDocument(userA, teamA.id, ['test@example.com']);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/move`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { id: doc.id, teamId: teamB.id },
    });

    expect(res.ok()).toBeFalsy();
    expect([404, 401, 500]).toContain(res.status());
  });
});
