import { expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { FieldType, Prisma, ReadStatus, SendStatus, SigningStatus } from '@documenso/prisma/client';
import {
  seedBlankDocument,
  seedCompletedDocument,
  seedDraftDocument,
  seedPendingDocument,
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
    const doc = await seedDraftDocument(userA, teamA.id, []);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/move`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { documentId: doc.id, teamId: teamB.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should block unauthorized access to document distribute endpoint', async ({ request }) => {
    const doc = await seedDraftDocument(userA, teamA.id, ['test@example.com']);

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/distribute`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { documentId: doc.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(500);
  });

  test('should block unauthorized access to document redistribute endpoint', async ({
    request,
  }) => {
    const doc = await seedPendingDocument(userA, teamA.id, []);

    const userRecipient = await prisma.recipient.create({
      data: {
        email: 'test@example.com',
        name: 'Test',
        token: nanoid(),
        readStatus: ReadStatus.NOT_OPENED,
        sendStatus: SendStatus.SENT,
        signingStatus: SigningStatus.NOT_SIGNED,
        signedAt: null,
        document: {
          connect: {
            id: doc.id,
          },
        },
        fields: {
          create: {
            page: 1,
            type: FieldType.NAME,
            inserted: true,
            customText: '',
            positionX: new Prisma.Decimal(1),
            positionY: new Prisma.Decimal(1),
            width: new Prisma.Decimal(1),
            height: new Prisma.Decimal(1),
            documentId: doc.id,
          },
        },
      },
    });

    const recipient = await prisma.recipient.findFirst({
      where: {
        documentId: doc.id,
        email: userRecipient.email,
      },
    });

    const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/document/redistribute`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { documentId: doc.id, recipients: [recipient!.id] },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(500);
  });
});
