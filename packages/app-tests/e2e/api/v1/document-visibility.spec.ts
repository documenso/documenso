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
    const resB = await request.post(`${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}/resend`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { recipients: [] },
    });
    expect(resB.ok()).toBeFalsy();
    expect([401, 404]).toContain(resB.status());
  });

  test('should block access to document recipients endpoint', async ({ request }) => {
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
    const resB = await request.post(
      `${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}/recipients`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { name: 'Test', email: 'test@example.com' },
      },
    );
    expect(resB.ok()).toBeFalsy();
    expect([401, 404]).toContain(resB.status());
  });

  test('should block access to document fields endpoint', async ({ request }) => {
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
    const resB = await request.post(`${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}/fields`, {
      headers: { Authorization: `Bearer ${tokenB}` },
      data: { type: 'TEXT', page: 1, positionX: 1, positionY: 1, width: 1, height: 1 },
    });
    expect(resB.ok()).toBeFalsy();
    expect([401, 404]).toContain(resB.status());
  });

  test('should block access to template get endpoint', async ({ request }) => {
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
    const templateA = await seedBlankTemplate(userA, teamA.id);
    const resB = await request.get(`${WEBAPP_BASE_URL}/api/v1/templates/${templateA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(resB.ok()).toBeFalsy();
    expect([401, 404]).toContain(resB.status());
  });

  test('should block access to template delete endpoint', async ({ request }) => {
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
    const templateA = await seedBlankTemplate(userA, teamA.id);
    const resB = await request.delete(`${WEBAPP_BASE_URL}/api/v1/templates/${templateA.id}`, {
      headers: { Authorization: `Bearer ${tokenB}` },
    });
    expect(resB.ok()).toBeFalsy();
    expect([401, 404]).toContain(resB.status());
  });

  test('should block access to template generate-document endpoint', async ({ request }) => {
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
    const templateA = await seedBlankTemplate(userA, teamA.id);
    const resB = await request.post(
      `${WEBAPP_BASE_URL}/api/v1/templates/${templateA.id}/generate-document`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { title: 'Test', recipients: [] },
      },
    );
    expect(resB.ok()).toBeFalsy();
    expect([401, 404]).toContain(resB.status());
  });

  test('should block PATCH and DELETE on recipients endpoint', async ({ request }) => {
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
    // Use a dummy recipientId (should not matter, access is blocked)
    const recipientId = 999999;
    // PATCH
    const patchRes = await request.patch(
      `${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}/recipients/${recipientId}`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { name: 'Hacker', email: 'hacker@example.com' },
      },
    );
    expect(patchRes.ok()).toBeFalsy();
    expect([401, 404]).toContain(patchRes.status());
    // DELETE
    const deleteRes = await request.delete(
      `${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}/recipients/${recipientId}`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {},
      },
    );
    expect(deleteRes.ok()).toBeFalsy();
    expect([401, 404]).toContain(deleteRes.status());
  });

  test('should block PATCH and DELETE on fields endpoint', async ({ request }) => {
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
    // Use a dummy fieldId (should not matter, access is blocked)
    const fieldId = 999999;
    // PATCH
    const patchRes = await request.patch(
      `${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}/fields/${fieldId}`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: { type: 'TEXT', page: 1, positionX: 1, positionY: 1, width: 1, height: 1 },
      },
    );
    expect(patchRes.ok()).toBeFalsy();
    expect([401, 404]).toContain(patchRes.status());
    // DELETE
    const deleteRes = await request.delete(
      `${WEBAPP_BASE_URL}/api/v1/documents/${documentA.id}/fields/${fieldId}`,
      {
        headers: { Authorization: `Bearer ${tokenB}` },
        data: {},
      },
    );
    expect(deleteRes.ok()).toBeFalsy();
    expect([401, 404]).toContain(deleteRes.status());
  });
});
