import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { seedCompletedDocument, seedDraftDocument, seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { DocumentStatus, TeamMemberRole } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

const createTokenForUser = async (userId: number, teamId: number, tokenName: string) => {
  const { token } = await createApiToken({
    userId,
    teamId,
    tokenName,
    expiresIn: null,
  });

  return token;
};

test.describe('Envelope cancel endpoint authorization', () => {
  test('hides the document from an outsider attempting to cancel it', async ({ request }) => {
    const { user: owner, team } = await seedUser();
    const { user: recipient } = await seedUser();
    const document = await seedPendingDocument(owner, team.id, [recipient]);

    const { user: outsider, team: outsiderTeam } = await seedUser();
    const outsiderToken = await createTokenForUser(outsider.id, outsiderTeam.id, 'outsider');

    const res = await request.post(`${baseUrl}/envelope/cancel`, {
      headers: { Authorization: `Bearer ${outsiderToken}` },
      data: { envelopeId: document.id },
    });

    // Outsiders must not be able to determine whether the envelope exists.
    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);

    // The document must be untouched.
    const documentInDb = await prisma.envelope.findFirstOrThrow({
      where: { id: document.id },
      select: { status: true },
    });

    expect(documentInDb.status).toBe(DocumentStatus.PENDING);
  });

  test('hides the document from a recipient attempting to cancel it', async ({ request }) => {
    const { user: owner, team } = await seedUser();
    const { user: recipient, team: recipientTeam } = await seedUser();
    const document = await seedPendingDocument(owner, team.id, [recipient]);

    const recipientToken = await createTokenForUser(recipient.id, recipientTeam.id, 'recipient');

    const res = await request.post(`${baseUrl}/envelope/cancel`, {
      headers: { Authorization: `Bearer ${recipientToken}` },
      data: { envelopeId: document.id },
    });

    // A recipient is not a member of the document's team, so they must not be
    // able to determine whether it exists via this endpoint.
    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);

    const documentInDb = await prisma.envelope.findFirstOrThrow({
      where: { id: document.id },
      select: { status: true },
    });

    expect(documentInDb.status).toBe(DocumentStatus.PENDING);
  });

  // Note: a non-privileged MEMBER cannot obtain an API token at all (token
  // creation requires the MANAGE_TEAM permission), so the MEMBER cancellation
  // restriction is covered through the UI tests in cancel-documents.spec.ts
  // rather than at the API layer.

  test('allows the document owner to cancel a pending document', async ({ request }) => {
    const { user: owner, team } = await seedUser();
    const { user: recipient } = await seedUser();
    const document = await seedPendingDocument(owner, team.id, [recipient]);

    const ownerToken = await createTokenForUser(owner.id, team.id, 'owner');

    const res = await request.post(`${baseUrl}/envelope/cancel`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { envelopeId: document.id },
    });

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const documentInDb = await prisma.envelope.findFirstOrThrow({
      where: { id: document.id },
      select: { status: true, completedAt: true, deletedAt: true },
    });

    expect(documentInDb.status).toBe(DocumentStatus.CANCELLED);
    expect(documentInDb.completedAt).not.toBeNull();
    expect(documentInDb.deletedAt).toBeNull();
  });

  test('allows a team ADMIN to cancel a pending document they do not own', async ({ request }) => {
    const { team, owner } = await seedTeam();

    const adminUser = await seedTeamMember({
      teamId: team.id,
      role: TeamMemberRole.ADMIN,
    });

    const { user: recipient } = await seedUser();
    const document = await seedPendingDocument(owner, team.id, [recipient]);

    const adminToken = await createTokenForUser(adminUser.id, team.id, 'admin');

    const res = await request.post(`${baseUrl}/envelope/cancel`, {
      headers: { Authorization: `Bearer ${adminToken}` },
      data: { envelopeId: document.id },
    });

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const documentInDb = await prisma.envelope.findFirstOrThrow({
      where: { id: document.id },
      select: { status: true },
    });

    expect(documentInDb.status).toBe(DocumentStatus.CANCELLED);
  });

  test('allows a team MANAGER to cancel a pending document they do not own', async ({ request }) => {
    const { team, owner } = await seedTeam();

    const managerUser = await seedTeamMember({
      teamId: team.id,
      role: TeamMemberRole.MANAGER,
    });

    const { user: recipient } = await seedUser();
    const document = await seedPendingDocument(owner, team.id, [recipient]);

    const managerToken = await createTokenForUser(managerUser.id, team.id, 'manager');

    const res = await request.post(`${baseUrl}/envelope/cancel`, {
      headers: { Authorization: `Bearer ${managerToken}` },
      data: { envelopeId: document.id },
    });

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);

    const documentInDb = await prisma.envelope.findFirstOrThrow({
      where: { id: document.id },
      select: { status: true },
    });

    expect(documentInDb.status).toBe(DocumentStatus.CANCELLED);
  });

  test('rejects cancelling a draft document', async ({ request }) => {
    const { user: owner, team } = await seedUser();
    const document = await seedDraftDocument(owner, team.id, []);

    const ownerToken = await createTokenForUser(owner.id, team.id, 'owner-draft');

    const res = await request.post(`${baseUrl}/envelope/cancel`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { envelopeId: document.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(400);

    const documentInDb = await prisma.envelope.findFirstOrThrow({
      where: { id: document.id },
      select: { status: true },
    });

    expect(documentInDb.status).toBe(DocumentStatus.DRAFT);
  });

  test('rejects cancelling a completed document', async ({ request }) => {
    const { user: owner, team } = await seedUser();
    const { user: recipient } = await seedUser();
    const document = await seedCompletedDocument(owner, team.id, [recipient]);

    const ownerToken = await createTokenForUser(owner.id, team.id, 'owner-completed');

    const res = await request.post(`${baseUrl}/envelope/cancel`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { envelopeId: document.id },
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(400);

    const documentInDb = await prisma.envelope.findFirstOrThrow({
      where: { id: document.id },
      select: { status: true },
    });

    expect(documentInDb.status).toBe(DocumentStatus.COMPLETED);
  });

  test('rejects double cancellation of an already cancelled document', async ({ request }) => {
    const { user: owner, team } = await seedUser();
    const { user: recipient } = await seedUser();
    const document = await seedPendingDocument(owner, team.id, [recipient]);

    const ownerToken = await createTokenForUser(owner.id, team.id, 'owner-double');

    const firstRes = await request.post(`${baseUrl}/envelope/cancel`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { envelopeId: document.id },
    });

    expect(firstRes.status()).toBe(200);

    const secondRes = await request.post(`${baseUrl}/envelope/cancel`, {
      headers: { Authorization: `Bearer ${ownerToken}` },
      data: { envelopeId: document.id },
    });

    expect(secondRes.ok()).toBeFalsy();
    expect(secondRes.status()).toBe(400);

    const documentInDb = await prisma.envelope.findFirstOrThrow({
      where: { id: document.id },
      select: { status: true },
    });

    expect(documentInDb.status).toBe(DocumentStatus.CANCELLED);
  });
});
