import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { hashString } from '@documenso/lib/server-only/auth/hash';
import { alphaid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { DocumentVisibility, TeamMemberRole } from '@documenso/prisma/client';
import { seedCompletedDocument } from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { expect, test } from '@playwright/test';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const API_BASE_URL = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({ mode: 'parallel' });

const seedApiTokenForUser = async ({ userId, teamId }: { userId: number; teamId: number }) => {
  const token = `api_${alphaid(16)}`;

  await prisma.apiToken.create({
    data: { name: 'recipient-access-test', token: hashString(token), expires: null, userId, teamId },
  });

  return { token };
};

/**
 * Reading a recipient exposes its signing token (a bearer credential), so the
 * recipient read must enforce document visibility — a member who cannot read a
 * restricted document must not be able to read its recipients either. This
 * mirrors the field read, which is asserted as a control below.
 */
test('[RECIPIENT]: a member cannot read a recipient of a restricted document', async ({ request }) => {
  const { team, owner } = await seedTeam();
  const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  const { token: memberToken } = await seedApiTokenForUser({ userId: member.id, teamId: team.id });

  const document = await seedCompletedDocument(owner, team.id, ['recipient@test.documenso.com'], {
    createDocumentOptions: { visibility: DocumentVisibility.ADMIN },
  });

  const recipient = await prisma.recipient.findFirstOrThrow({ where: { envelopeId: document.id } });

  const res = await request.get(`${API_BASE_URL}/envelope/recipient/${recipient.id}`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });

  expect(res.status()).toBe(404);

  const body = res.ok() ? await res.json() : null;
  expect(body?.token).toBeUndefined();
});

test('[RECIPIENT]: a member cannot read a field of a restricted document', async ({ request }) => {
  const { team, owner } = await seedTeam();
  const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  const { token: memberToken } = await seedApiTokenForUser({ userId: member.id, teamId: team.id });

  const document = await seedCompletedDocument(owner, team.id, ['recipient@test.documenso.com'], {
    createDocumentOptions: { visibility: DocumentVisibility.ADMIN },
  });

  const field = await prisma.field.findFirst({ where: { envelopeId: document.id } });

  test.skip(!field, 'No field seeded on completed document');

  const res = await request.get(`${API_BASE_URL}/envelope/field/${field!.id}`, {
    headers: { Authorization: `Bearer ${memberToken}` },
  });

  expect(res.status()).toBe(404);
});
