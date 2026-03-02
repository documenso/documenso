import { expect, test } from '@playwright/test';
import type { Team, User } from '@documenso/prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

test.describe('Envelope Attachments API V2', () => {
  let userA: User, teamA: Team, userB: User, teamB: Team, tokenA: string, tokenB: string;

  test.beforeEach(async () => {
    ({ user: userA, team: teamA } = await seedUser());
    ({ token: tokenA } = await createApiToken({
      userId: userA.id,
      teamId: teamA.id,
      tokenName: 'userA',
      expiresIn: null,
    }));

    ({ user: userB, team: teamB } = await seedUser());
    ({ token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    }));
  });

  test.describe('Envelope attachment find endpoint', () => {
    test('should block unauthorized access to envelope attachment find endpoint', async ({
      request,
    }) => {
      const doc = await seedBlankDocument(userA, teamA.id);

      const res = await request.get(
        `${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment?envelopeId=${doc.id}`,
        {
          headers: { Authorization: `Bearer ${tokenB}` },
        },
      );

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to envelope attachment find endpoint', async ({
      request,
    }) => {
      const doc = await seedBlankDocument(userA, teamA.id);

      const res = await request.get(
        `${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment?envelopeId=${doc.id}`,
        {
          headers: { Authorization: `Bearer ${tokenA}` },
        },
      );

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Envelope attachment create endpoint', () => {
    test('should block unauthorized access to envelope attachment create endpoint', async ({
      request,
    }) => {
      const doc = await seedBlankDocument(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment/create`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          envelopeId: doc.id,
          data: {
            label: 'Test Attachment',
            data: 'https://example.com/file.pdf',
          },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to envelope attachment create endpoint', async ({
      request,
    }) => {
      const doc = await seedBlankDocument(userA, teamA.id);

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment/create`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          envelopeId: doc.id,
          data: {
            label: 'Test Attachment',
            data: 'https://example.com/file.pdf',
          },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Envelope attachment update endpoint', () => {
    test('should block unauthorized access to envelope attachment update endpoint', async ({
      request,
    }) => {
      const doc = await seedBlankDocument(userA, teamA.id);

      const attachment = await prisma.envelopeAttachment.create({
        data: {
          envelopeId: doc.id,
          type: 'link',
          label: 'Original Label',
          data: 'https://example.com/original.pdf',
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment/update`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {
          id: attachment.id,
          data: {
            label: 'Updated Label',
            data: 'https://example.com/updated.pdf',
          },
        },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to envelope attachment update endpoint', async ({
      request,
    }) => {
      const doc = await seedBlankDocument(userA, teamA.id);

      const attachment = await prisma.envelopeAttachment.create({
        data: {
          envelopeId: doc.id,
          type: 'link',
          label: 'Original Label',
          data: 'https://example.com/original.pdf',
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment/update`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: {
          id: attachment.id,
          data: {
            label: 'Updated Label',
            data: 'https://example.com/updated.pdf',
          },
        },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });

  test.describe('Envelope attachment delete endpoint', () => {
    test('should block unauthorized access to envelope attachment delete endpoint', async ({
      request,
    }) => {
      const doc = await seedBlankDocument(userA, teamA.id);

      const attachment = await prisma.envelopeAttachment.create({
        data: {
          envelopeId: doc.id,
          type: 'link',
          label: 'Test Attachment',
          data: 'https://example.com/file.pdf',
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment/delete`, {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { id: attachment.id },
      });

      expect(res.ok()).toBeFalsy();
      expect(res.status()).toBe(404);
    });

    test('should allow authorized access to envelope attachment delete endpoint', async ({
      request,
    }) => {
      const doc = await seedBlankDocument(userA, teamA.id);

      const attachment = await prisma.envelopeAttachment.create({
        data: {
          envelopeId: doc.id,
          type: 'link',
          label: 'Test Attachment',
          data: 'https://example.com/file.pdf',
        },
      });

      const res = await request.post(`${WEBAPP_BASE_URL}/api/v2-beta/envelope/attachment/delete`, {
        headers: { Authorization: `Bearer ${tokenA}` },
        data: { id: attachment.id },
      });

      expect(res.ok()).toBeTruthy();
      expect(res.status()).toBe(200);
    });
  });
});
