import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import {
  seedBlankDocument,
  seedCompletedDocument,
  seedPendingDocumentWithFullFields,
} from '@documenso/prisma/seed/documents';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe('Document Access API V1', () => {
  test('should block access to documents not owned by the user', async ({ request }) => {
    const { user: userA, team: teamA } = await seedUser();

    const { user: userB, team: teamB } = await seedUser();
    const { token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    });

    const documentA = await seedBlankDocument(userA, teamA.id);

    // User B cannot access User A's document
    const resB = await request.get(`${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(resB.ok()).toBeFalsy();
    expect(resB.status()).toBe(404);
  });

  test('should block access to document download endpoint', async ({ request }) => {
    const { user: userA, team: teamA } = await seedUser();

    const { user: userB, team: teamB } = await seedUser();
    const { token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    });

    const documentA = await seedCompletedDocument(userA, teamA.id, ['test@example.com'], {
      createDocumentOptions: { title: 'Document 1 - Completed' },
    });

    const resB = await request.get(`${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}/download`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(resB.ok()).toBeFalsy();
    expect(resB.status()).toBe(500);
  });

  test('should block access to document delete endpoint', async ({ request }) => {
    const { user: userA, team: teamA } = await seedUser();

    const { user: userB, team: teamB } = await seedUser();
    const { token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    });

    const documentA = await seedBlankDocument(userA, teamA.id);

    const resB = await request.delete(`${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(resB.ok()).toBeFalsy();
    expect(resB.status()).toBe(404);
  });

  test('should block access to document send endpoint', async ({ request }) => {
    const { user: userA, team: teamA } = await seedUser();

    const { user: userB, team: teamB } = await seedUser();
    const { token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    });

    const { document: documentA } = await seedPendingDocumentWithFullFields({
      owner: userA,
      recipients: ['test@example.com'],
      teamId: teamA.id,
    });

    const resB = await request.post(`${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}/send`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: {},
    });

    expect(resB.ok()).toBeFalsy();
    expect(resB.status()).toBe(500);
  });

  test('should block access to document resend endpoint', async ({ request }) => {
    const { user: userA, team: teamA } = await seedUser();

    const { user: userB, team: teamB } = await seedUser();
    const { token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    });

    const { user: recipientUser } = await seedUser();

    const { document: documentA, recipients } = await seedPendingDocumentWithFullFields({
      owner: userA,
      recipients: [recipientUser.email],
      teamId: teamA.id,
    });

    const resB = await request.post(`${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}/resend`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: {
        recipients: [recipients[0].id],
      },
    });

    expect(resB.ok()).toBeFalsy();
    expect(resB.status()).toBe(500);
  });

  test('should block access to document recipients endpoint', async ({ request }) => {
    const { user: userA, team: teamA } = await seedUser();

    const { user: userB, team: teamB } = await seedUser();
    const { token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    });

    const documentA = await seedBlankDocument(userA, teamA.id);

    const resB = await request.post(
      `${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}/recipients`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { name: 'Test', email: 'test@example.com' },
      },
    );

    expect(resB.ok()).toBeFalsy();
    expect(resB.status()).toBe(401);
  });

  test('should block access to template get endpoint', async ({ request }) => {
    const { user: userA, team: teamA } = await seedUser();

    const { user: userB, team: teamB } = await seedUser();
    const { token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    });

    const templateA = await seedBlankTemplate(userA, teamA.id);

    const resB = await request.get(`${WEBAPP_BASE_URL}/api/v1/templates/${templateA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(resB.ok()).toBeFalsy();
    expect(resB.status()).toBe(404);
  });

  test('should block access to template delete endpoint', async ({ request }) => {
    const { user: userA, team: teamA } = await seedUser();

    const { user: userB, team: teamB } = await seedUser();
    const { token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'userB',
      expiresIn: null,
    });

    const templateA = await seedBlankTemplate(userA, teamA.id);

    const resB = await request.delete(`${WEBAPP_BASE_URL}/api/v1/templates/${templateA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });

    expect(resB.ok()).toBeFalsy();
    expect(resB.status()).toBe(404);
  });
});
