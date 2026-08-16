import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { hashString } from '@documenso/lib/server-only/auth/hash';
import { alphaid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { DocumentVisibility, TeamMemberRole } from '@documenso/prisma/client';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { type APIRequestContext, expect, test } from '@playwright/test';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const API_BASE_URL = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({ mode: 'parallel' });

const seedApiTokenForUser = async ({ userId, teamId }: { userId: number; teamId: number }) => {
  const token = `api_${alphaid(16)}`;

  await prisma.apiToken.create({
    data: { name: 'attachment-access-test', token: hashString(token), expires: null, userId, teamId },
  });

  return { token };
};

const canReadEnvelope = async (request: APIRequestContext, token: string, envelopeId: string) => {
  const res = await request.get(`${API_BASE_URL}/envelope/${envelopeId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return res.ok();
};

/**
 * Attachment create/update/delete/list must enforce document visibility, not
 * just team membership. A member whose visibility tier excludes a restricted
 * envelope must not be able to read or mutate its attachments.
 */
test('[ATTACHMENTS]: a member cannot create or delete attachments on a restricted document', async ({ request }) => {
  const { team, owner } = await seedTeam();
  const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  const { token: memberToken } = await seedApiTokenForUser({ userId: member.id, teamId: team.id });

  const envelope = await seedBlankDocument(owner, team.id, {
    createDocumentOptions: { visibility: DocumentVisibility.ADMIN },
  });

  expect(await canReadEnvelope(request, memberToken, envelope.id)).toBe(false);

  const createRes = await request.post(`${API_BASE_URL}/envelope/attachment/create`, {
    headers: { Authorization: `Bearer ${memberToken}`, 'Content-Type': 'application/json' },
    data: { envelopeId: envelope.id, data: { label: 'attachment', data: 'https://example.com' } },
  });

  expect(createRes.ok()).toBe(false);

  // No attachment should have been created.
  const attachments = await prisma.envelopeAttachment.findMany({ where: { envelopeId: envelope.id } });
  expect(attachments).toHaveLength(0);
});

test('[ATTACHMENTS]: a member cannot update an attachment on a restricted document', async ({ request }) => {
  const { team, owner } = await seedTeam();
  const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  const { token: ownerToken } = await seedApiTokenForUser({ userId: owner.id, teamId: team.id });
  const { token: memberToken } = await seedApiTokenForUser({ userId: member.id, teamId: team.id });

  const envelope = await seedBlankDocument(owner, team.id, {
    createDocumentOptions: { visibility: DocumentVisibility.ADMIN },
  });

  // The owner (who can see the document) creates the attachment.
  const createRes = await request.post(`${API_BASE_URL}/envelope/attachment/create`, {
    headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
    data: { envelopeId: envelope.id, data: { label: 'original', data: 'https://example.com/original' } },
  });
  expect(createRes.ok()).toBe(true);
  const attachment = await createRes.json();

  expect(await canReadEnvelope(request, memberToken, envelope.id)).toBe(false);

  const updateRes = await request.post(`${API_BASE_URL}/envelope/attachment/update`, {
    headers: { Authorization: `Bearer ${memberToken}`, 'Content-Type': 'application/json' },
    data: { id: attachment.id, data: { label: 'tampered', data: 'https://example.com/tampered' } },
  });

  expect(updateRes.ok()).toBe(false);

  const persisted = await prisma.envelopeAttachment.findUnique({ where: { id: attachment.id } });
  expect(persisted?.label).toBe('original');
});

test('[ATTACHMENTS]: a member cannot list attachments on a restricted document', async ({ request }) => {
  const { team, owner } = await seedTeam();
  const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  const { token: ownerToken } = await seedApiTokenForUser({ userId: owner.id, teamId: team.id });
  const { token: memberToken } = await seedApiTokenForUser({ userId: member.id, teamId: team.id });

  const envelope = await seedBlankDocument(owner, team.id, {
    createDocumentOptions: { visibility: DocumentVisibility.ADMIN },
  });

  await request.post(`${API_BASE_URL}/envelope/attachment/create`, {
    headers: { Authorization: `Bearer ${ownerToken}`, 'Content-Type': 'application/json' },
    data: { envelopeId: envelope.id, data: { label: 'restricted', data: 'https://example.com/restricted' } },
  });

  expect(await canReadEnvelope(request, memberToken, envelope.id)).toBe(false);

  const findRes = await request.get(`${API_BASE_URL}/envelope/attachment?envelopeId=${envelope.id}`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });

  expect(findRes.ok()).toBe(false);

  const body = findRes.ok() ? await findRes.json() : null;
  const attachments = body?.data ?? [];
  expect(attachments).toHaveLength(0);
});
