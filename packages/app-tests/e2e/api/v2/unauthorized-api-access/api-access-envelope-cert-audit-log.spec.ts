import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { hashString } from '@documenso/lib/server-only/auth/hash';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { alphaid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { DocumentVisibility, TeamMemberRole } from '@documenso/prisma/client';
import { seedCompletedDocument } from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import { type APIRequestContext, expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const API_BASE_URL = `${WEBAPP_BASE_URL}/api/v2-beta`;

/**
 * Create an API token directly, bypassing the role check in `createApiToken`.
 *
 * This simulates a token that was minted while the user had permission, and which
 * survives a later downgrade to a lower team role (e.g. MEMBER). Such a token must
 * still respect document visibility at request time.
 */
const seedApiTokenForUser = async ({
  userId,
  teamId,
  tokenName,
}: {
  userId: number;
  teamId: number;
  tokenName: string;
}) => {
  const token = `api_${alphaid(16)}`;

  await prisma.apiToken.create({
    data: {
      name: tokenName,
      token: hashString(token),
      expires: null,
      userId,
      teamId,
    },
  });

  return { token };
};

test.describe.configure({
  mode: 'parallel',
});

const downloadAuditLogPdf = (request: APIRequestContext, envelopeId: string, authToken?: string) => {
  return request.get(`${API_BASE_URL}/envelope/${envelopeId}/audit-log/download`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
};

const downloadCertificatePdf = (request: APIRequestContext, envelopeId: string, authToken?: string) => {
  return request.get(`${API_BASE_URL}/envelope/${envelopeId}/certificate/download`, {
    headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
  });
};

test.describe('Envelope certificate / audit log PDF download API V2 - access control', () => {
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

  test('should reject audit log download without an API token', async ({ request }) => {
    const document = await seedCompletedDocument(userA, teamA.id, ['recipient@test.documenso.com']);

    const res = await downloadAuditLogPdf(request, document.id);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });

  test('should reject certificate download without an API token', async ({ request }) => {
    const document = await seedCompletedDocument(userA, teamA.id, ['recipient@test.documenso.com']);

    const res = await downloadCertificatePdf(request, document.id);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });

  test('should reject audit log download from a user in a different team', async ({ request }) => {
    const document = await seedCompletedDocument(userA, teamA.id, ['recipient@test.documenso.com']);

    const res = await downloadAuditLogPdf(request, document.id, tokenB);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should reject certificate download from a user in a different team', async ({ request }) => {
    const document = await seedCompletedDocument(userA, teamA.id, ['recipient@test.documenso.com']);

    const res = await downloadCertificatePdf(request, document.id, tokenB);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should reject a disabled user downloading the audit log', async ({ request }) => {
    const document = await seedCompletedDocument(userA, teamA.id, ['recipient@test.documenso.com']);

    await prisma.user.update({
      where: { id: userA.id },
      data: { disabled: true },
    });

    const res = await downloadAuditLogPdf(request, document.id, tokenA);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });

  test('should reject a disabled user downloading the certificate', async ({ request }) => {
    const document = await seedCompletedDocument(userA, teamA.id, ['recipient@test.documenso.com']);

    await prisma.user.update({
      where: { id: userA.id },
      data: { disabled: true },
    });

    const res = await downloadCertificatePdf(request, document.id, tokenA);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });

  test('should return 404 for a non-existent envelope id', async ({ request }) => {
    const auditLogRes = await downloadAuditLogPdf(request, 'envelope_doesnotexist', tokenA);
    expect(auditLogRes.status()).toBe(404);

    const certificateRes = await downloadCertificatePdf(request, 'envelope_doesnotexist', tokenA);
    expect(certificateRes.status()).toBe(404);
  });
});

test.describe('Envelope certificate / audit log PDF download API V2 - document visibility', () => {
  test.describe.configure({
    mode: 'parallel',
  });

  test('should hide an ADMIN-only document from a downgraded member (audit log)', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

    const { token: memberToken } = await seedApiTokenForUser({
      userId: member.id,
      teamId: team.id,
      tokenName: 'member-audit-log-token',
    });

    // ADMIN-visibility document owned by the team owner - a member must not see it.
    const document = await seedCompletedDocument(owner, team.id, ['recipient@test.documenso.com'], {
      createDocumentOptions: { visibility: DocumentVisibility.ADMIN },
    });

    const res = await downloadAuditLogPdf(request, document.id, memberToken);

    // Visibility failure surfaces as not-found, matching the canonical access checks.
    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should hide an ADMIN-only document from a downgraded member (certificate)', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

    const { token: memberToken } = await seedApiTokenForUser({
      userId: member.id,
      teamId: team.id,
      tokenName: 'member-certificate-token',
    });

    const document = await seedCompletedDocument(owner, team.id, ['recipient@test.documenso.com'], {
      createDocumentOptions: { visibility: DocumentVisibility.ADMIN },
    });

    const res = await downloadCertificatePdf(request, document.id, memberToken);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should hide a MANAGER_AND_ABOVE document from a downgraded member (audit log)', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

    const { token: memberToken } = await seedApiTokenForUser({
      userId: member.id,
      teamId: team.id,
      tokenName: 'member-manager-vis-token',
    });

    const document = await seedCompletedDocument(owner, team.id, ['recipient@test.documenso.com'], {
      createDocumentOptions: { visibility: DocumentVisibility.MANAGER_AND_ABOVE },
    });

    const res = await downloadAuditLogPdf(request, document.id, memberToken);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should hide a MANAGER_AND_ABOVE document from a downgraded member (certificate)', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

    const { token: memberToken } = await seedApiTokenForUser({
      userId: member.id,
      teamId: team.id,
      tokenName: 'member-manager-vis-cert-token',
    });

    const document = await seedCompletedDocument(owner, team.id, ['recipient@test.documenso.com'], {
      createDocumentOptions: { visibility: DocumentVisibility.MANAGER_AND_ABOVE },
    });

    const res = await downloadCertificatePdf(request, document.id, memberToken);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should hide an ADMIN-only document from a downgraded manager (certificate)', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const manager = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });

    const { token: managerToken } = await seedApiTokenForUser({
      userId: manager.id,
      teamId: team.id,
      tokenName: 'manager-admin-vis-cert-token',
    });

    const document = await seedCompletedDocument(owner, team.id, ['recipient@test.documenso.com'], {
      createDocumentOptions: { visibility: DocumentVisibility.ADMIN },
    });

    const res = await downloadCertificatePdf(request, document.id, managerToken);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should allow a member to download an EVERYONE-visibility document (audit log)', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

    const { token: memberToken } = await seedApiTokenForUser({
      userId: member.id,
      teamId: team.id,
      tokenName: 'member-everyone-vis-token',
    });

    const document = await seedCompletedDocument(owner, team.id, ['recipient@test.documenso.com'], {
      createDocumentOptions: { visibility: DocumentVisibility.EVERYONE },
    });

    const res = await downloadAuditLogPdf(request, document.id, memberToken);

    expect(res.ok()).toBeTruthy();
    expect(res.status()).toBe(200);
    expect(res.headers()['content-type']).toContain('application/pdf');
  });
});
