import { expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import {
  DocumentStatus,
  DocumentVisibility,
  EnvelopeType,
  TeamMemberRole,
} from '@documenso/prisma/client';
import {
  seedBlankDocument,
  seedCompletedDocument,
  seedDraftDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamEmail, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TFindEnvelopesResponse } from '@documenso/trpc/server/envelope-router/find-envelopes.types';

import { apiSignin } from '../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2-beta`;

test.describe.configure({
  mode: 'parallel',
});

// Helper to make authenticated GET requests to the find envelopes endpoint.
const findEnvelopes = async (
  request: import('@playwright/test').APIRequestContext,
  token: string,
  params: Record<string, string> = {},
) => {
  const searchParams = new URLSearchParams(params);
  const url = `${baseUrl}/envelope${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const res = await request.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return {
    res,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    json: res.ok() ? ((await res.json()) as TFindEnvelopesResponse) : null,
  };
};

// ─── Expected Output Tests ───────────────────────────────────────────────────

test.describe('Find Envelopes API - Basic', () => {
  let userA: User, teamA: Team, tokenA: string;
  let userB: User, teamB: Team, tokenB: string;

  test.beforeEach(async () => {
    ({ user: userA, team: teamA } = await seedUser());
    ({ token: tokenA } = await createApiToken({
      userId: userA.id,
      teamId: teamA.id,
      tokenName: 'tokenA',
      expiresIn: null,
    }));

    ({ user: userB, team: teamB } = await seedUser());
    ({ token: tokenB } = await createApiToken({
      userId: userB.id,
      teamId: teamB.id,
      tokenName: 'tokenB',
      expiresIn: null,
    }));
  });

  test('should return empty results when no envelopes exist', async ({ request }) => {
    const { json } = await findEnvelopes(request, tokenA);
    expect(json!.data).toHaveLength(0);
    expect(json!.count).toBe(0);
    expect(json!.currentPage).toBe(1);
    expect(json!.totalPages).toBe(0);
  });

  test('should return only envelopes owned by the user and not the other user', async ({
    request,
  }) => {
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'UserA Doc' },
    });
    await seedDraftDocument(userB, teamB.id, [], {
      createDocumentOptions: { title: 'UserB Doc' },
    });

    const { json: jsonA } = await findEnvelopes(request, tokenA);
    expect(jsonA!.data).toHaveLength(1);
    expect(jsonA!.data[0].title).toBe('UserA Doc');

    const { json: jsonB } = await findEnvelopes(request, tokenB);
    expect(jsonB!.data).toHaveLength(1);
    expect(jsonB!.data[0].title).toBe('UserB Doc');
  });

  test('should NOT leak envelopes between unrelated users', async ({ request }) => {
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Secret A1' },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Secret A2' },
    });
    await seedDraftDocument(userB, teamB.id, [], {
      createDocumentOptions: { title: 'Secret B1' },
    });

    const { json } = await findEnvelopes(request, tokenB);
    const titles = json!.data.map((d) => d.title);
    expect(titles).not.toContain('Secret A1');
    expect(titles).not.toContain('Secret A2');
    expect(titles).toContain('Secret B1');
    expect(json!.count).toBe(1);
  });

  test('should filter by status correctly', async ({ request }) => {
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Draft Doc' },
    });
    await seedPendingDocument(userA, teamA.id, [userB], {
      createDocumentOptions: { title: 'Pending Doc' },
    });
    await seedCompletedDocument(userA, teamA.id, [userB], {
      createDocumentOptions: { title: 'Completed Doc' },
    });

    // DRAFT only
    const { json: draftJson } = await findEnvelopes(request, tokenA, { status: 'DRAFT' });
    expect(draftJson!.data.every((d) => d.status === DocumentStatus.DRAFT)).toBe(true);
    expect(draftJson!.data.some((d) => d.title === 'Draft Doc')).toBe(true);
    expect(draftJson!.data.some((d) => d.title === 'Pending Doc')).toBe(false);

    // PENDING only
    const { json: pendingJson } = await findEnvelopes(request, tokenA, { status: 'PENDING' });
    expect(pendingJson!.data.every((d) => d.status === DocumentStatus.PENDING)).toBe(true);

    // COMPLETED only
    const { json: completedJson } = await findEnvelopes(request, tokenA, { status: 'COMPLETED' });
    expect(completedJson!.data.every((d) => d.status === DocumentStatus.COMPLETED)).toBe(true);
  });

  test('should filter by type (DOCUMENT vs TEMPLATE)', async ({ request }) => {
    await seedBlankDocument(userA, teamA.id, {
      createDocumentOptions: { title: 'A Document', type: EnvelopeType.DOCUMENT },
    });
    await seedBlankDocument(userA, teamA.id, {
      createDocumentOptions: { title: 'A Template', type: EnvelopeType.TEMPLATE },
    });

    const { json: docJson } = await findEnvelopes(request, tokenA, { type: 'DOCUMENT' });
    expect(docJson!.data.every((d) => d.type === EnvelopeType.DOCUMENT)).toBe(true);
    expect(docJson!.data.some((d) => d.title === 'A Document')).toBe(true);
    expect(docJson!.data.some((d) => d.title === 'A Template')).toBe(false);

    const { json: templateJson } = await findEnvelopes(request, tokenA, { type: 'TEMPLATE' });
    expect(templateJson!.data.every((d) => d.type === EnvelopeType.TEMPLATE)).toBe(true);
    expect(templateJson!.data.some((d) => d.title === 'A Template')).toBe(true);
    expect(templateJson!.data.some((d) => d.title === 'A Document')).toBe(false);
  });

  test('should paginate correctly', async ({ request }) => {
    // Create 5 docs, paginate with perPage=2
    for (let i = 1; i <= 5; i++) {
      await seedDraftDocument(userA, teamA.id, [], {
        createDocumentOptions: { title: `Paginated Doc ${i}` },
      });
    }

    const { json: page1 } = await findEnvelopes(request, tokenA, {
      page: '1',
      perPage: '2',
    });
    expect(page1!.data).toHaveLength(2);
    expect(page1!.count).toBe(5);
    expect(page1!.totalPages).toBe(3);
    expect(page1!.currentPage).toBe(1);

    const { json: page3 } = await findEnvelopes(request, tokenA, {
      page: '3',
      perPage: '2',
    });
    expect(page3!.data).toHaveLength(1);
    expect(page3!.currentPage).toBe(3);

    // Page beyond total
    const { json: pageBeyond } = await findEnvelopes(request, tokenA, {
      page: '10',
      perPage: '2',
    });
    expect(pageBeyond!.data).toHaveLength(0);
  });

  test('should search by title', async ({ request }) => {
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Annual Budget Report' },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Quarterly Review' },
    });

    const { json } = await findEnvelopes(request, tokenA, { query: 'Budget' });
    expect(json!.data).toHaveLength(1);
    expect(json!.data[0].title).toBe('Annual Budget Report');
  });

  test('should search by externalId', async ({ request }) => {
    await seedBlankDocument(userA, teamA.id, {
      createDocumentOptions: { title: 'External Doc', externalId: 'ext-abc-123' },
    });
    await seedBlankDocument(userA, teamA.id, {
      createDocumentOptions: { title: 'Other Doc', externalId: 'ext-xyz-789' },
    });

    const { json } = await findEnvelopes(request, tokenA, { query: 'abc-123' });
    expect(json!.data).toHaveLength(1);
    expect(json!.data[0].title).toBe('External Doc');
  });

  test('should search by recipient email and name', async ({ request }) => {
    const { user: recipientUser } = await seedUser();

    await seedPendingDocument(userA, teamA.id, [recipientUser], {
      createDocumentOptions: { title: 'Doc with Specific Recipient' },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Doc without Recipients' },
    });

    // Search by recipient email
    const { json: emailSearch } = await findEnvelopes(request, tokenA, {
      query: recipientUser.email,
    });
    expect(emailSearch!.data).toHaveLength(1);
    expect(emailSearch!.data[0].title).toBe('Doc with Specific Recipient');

    // Search by recipient name
    if (recipientUser.name) {
      const { json: nameSearch } = await findEnvelopes(request, tokenA, {
        query: recipientUser.name,
      });
      expect(nameSearch!.data.some((d) => d.title === 'Doc with Specific Recipient')).toBe(true);
    }
  });

  test('should search case-insensitively', async ({ request }) => {
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'UPPERCASE TITLE' },
    });

    const { json } = await findEnvelopes(request, tokenA, { query: 'uppercase title' });
    expect(json!.data).toHaveLength(1);
    expect(json!.data[0].title).toBe('UPPERCASE TITLE');
  });

  test('should order by createdAt descending by default', async ({ request }) => {
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'First Created' },
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Second Created' },
    });

    const { json } = await findEnvelopes(request, tokenA);
    expect(json!.data).toHaveLength(2);
    expect(json!.data[0].title).toBe('Second Created');
    expect(json!.data[1].title).toBe('First Created');
  });

  test('should support ascending order', async ({ request }) => {
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'First Created' },
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Second Created' },
    });

    const { json } = await findEnvelopes(request, tokenA, {
      orderByColumn: 'createdAt',
      orderByDirection: 'asc',
    });
    expect(json!.data[0].title).toBe('First Created');
    expect(json!.data[1].title).toBe('Second Created');
  });

  test('should filter by folderId and show root-level when no folderId', async ({ request }) => {
    const folder = await prisma.folder.create({
      data: {
        name: 'Test Folder',
        teamId: teamA.id,
        userId: userA.id,
        type: 'DOCUMENT',
      },
    });

    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'In Folder', folderId: folder.id },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'At Root' },
    });

    // No folderId → root-level only (folderId: null)
    const { json: rootJson } = await findEnvelopes(request, tokenA);
    const rootTitles = rootJson!.data.map((d) => d.title);
    expect(rootTitles).toContain('At Root');
    expect(rootTitles).not.toContain('In Folder');

    // With folderId → only docs in that folder
    const { json: folderJson } = await findEnvelopes(request, tokenA, { folderId: folder.id });
    expect(folderJson!.data).toHaveLength(1);
    expect(folderJson!.data[0].title).toBe('In Folder');
  });

  test('should not return deleted envelopes', async ({ request }) => {
    const doc = await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Deleted Doc' },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Active Doc' },
    });

    // Soft-delete
    await prisma.envelope.update({
      where: { id: doc.id },
      data: { deletedAt: new Date() },
    });

    const { json } = await findEnvelopes(request, tokenA);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Active Doc');
    expect(titles).not.toContain('Deleted Doc');
  });

  test('should return correct response schema fields', async ({ request }) => {
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Schema Check' },
    });

    const { json } = await findEnvelopes(request, tokenA);
    const envelope = json!.data[0];

    // Pagination fields
    expect(json!.count).toBeGreaterThan(0);
    expect(json!.currentPage).toBe(1);
    expect(json!.perPage).toBe(10);
    expect(json!.totalPages).toBeGreaterThan(0);

    // Envelope fields
    expect(envelope.id).toBeDefined();
    expect(envelope.title).toBe('Schema Check');
    expect(envelope.status).toBe(DocumentStatus.DRAFT);
    expect(envelope.type).toBe(EnvelopeType.DOCUMENT);
    expect(envelope.createdAt).toBeDefined();
    expect(envelope.updatedAt).toBeDefined();
    expect(envelope.deletedAt).toBeNull();

    // Included relations
    expect(envelope.user).toBeDefined();
    expect(envelope.user.id).toBe(userA.id);
    expect(envelope.user.email).toBe(userA.email);
    expect(envelope.recipients).toBeDefined();
    expect(envelope.team).toBeDefined();
  });

  test('should reject unauthenticated requests', async ({ request }) => {
    const { res } = await findEnvelopes(request, '');
    expect(res.ok()).toBeFalsy();
  });

  test('should reject invalid API tokens', async ({ request }) => {
    const { res } = await findEnvelopes(request, 'invalid-token-abc123');
    expect(res.ok()).toBeFalsy();
  });
});

// ─── Token Masking ───────────────────────────────────────────────────────────

test.describe('Find Envelopes API - Token Masking', () => {
  test('owner should see all recipient tokens on their envelopes', async ({ request }) => {
    const { user: owner, team } = await seedUser();
    const { user: recipient } = await seedUser();

    const { token } = await createApiToken({
      userId: owner.id,
      teamId: team.id,
      tokenName: 'ownerToken',
      expiresIn: null,
    });

    await seedPendingDocument(owner, team.id, [recipient], {
      createDocumentOptions: { title: 'Owner Token Test' },
    });

    const { json } = await findEnvelopes(request, token);
    const doc = json!.data.find((d) => d.title === 'Owner Token Test');
    expect(doc).toBeDefined();
    expect(doc!.recipients.length).toBeGreaterThan(0);
    // Owner sees actual token values (non-empty)
    doc!.recipients.forEach((r) => {
      expect(r.token).not.toBe('');
    });
  });

  test('non-owner team member should have recipient tokens masked', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
    const { user: recipient } = await seedUser();

    await seedPendingDocument(owner, team.id, [recipient], {
      createDocumentOptions: { title: 'Masked Token Test' },
    });

    const { token: memberToken } = await createApiToken({
      userId: member.id,
      teamId: team.id,
      tokenName: 'memberToken',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, memberToken);
    const doc = json!.data.find((d) => d.title === 'Masked Token Test');
    expect(doc).toBeDefined();
    expect(doc!.recipients.length).toBeGreaterThan(0);
    // Non-owner should see masked tokens (empty string)
    doc!.recipients.forEach((r) => {
      expect(r.token).toBe('');
    });
  });
});

// ─── Team Context & Visibility ───────────────────────────────────────────────

test.describe('Find Envelopes API - Team Context', () => {
  // Regression test: findEnvelopes previously had `{ userId }` as a top-level OR branch with no
  // teamId constraint, so personal docs leaked into team context. Fixed in the Kysely refactor.
  test('should return team envelopes for team members and exclude personal docs', async ({
    request,
  }) => {
    const { team, owner } = await seedTeam();
    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });

    // Team docs
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Team Doc by Owner' },
    });
    await seedDraftDocument(member, team.id, [], {
      createDocumentOptions: { title: 'Team Doc by Member' },
    });

    // Member's personal doc — should NOT appear in team context
    const memberOrg = await prisma.organisation.findFirstOrThrow({
      where: { ownerUserId: member.id },
      include: { teams: true },
    });
    const memberPersonalTeamId = memberOrg.teams[0].id;
    await seedDraftDocument(member, memberPersonalTeamId, [], {
      createDocumentOptions: { title: 'Member Personal Doc' },
    });

    const { token: memberToken } = await createApiToken({
      userId: member.id,
      teamId: team.id,
      tokenName: 'memberTeamToken',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, memberToken);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Team Doc by Owner');
    expect(titles).toContain('Team Doc by Member');
    expect(titles).not.toContain('Member Personal Doc');
  });

  test('should NOT show envelopes from other teams', async ({ request }) => {
    const { team: teamX, owner: ownerX } = await seedTeam();
    const { team: teamY, owner: ownerY } = await seedTeam();

    await seedDraftDocument(ownerX, teamX.id, [], {
      createDocumentOptions: { title: 'TeamX Doc' },
    });
    await seedDraftDocument(ownerY, teamY.id, [], {
      createDocumentOptions: { title: 'TeamY Doc' },
    });

    const { token: tokenX } = await createApiToken({
      userId: ownerX.id,
      teamId: teamX.id,
      tokenName: 'tokenX',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, tokenX);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('TeamX Doc');
    expect(titles).not.toContain('TeamY Doc');
  });

  test('should NOT leak team envelopes to non-members', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const { user: outsider, team: outsiderTeam } = await seedUser();

    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Team Secret Doc' },
    });

    const { token: outsiderToken } = await createApiToken({
      userId: outsider.id,
      teamId: outsiderTeam.id,
      tokenName: 'outsiderToken',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, outsiderToken);
    const titles = json!.data.map((d) => d.title);
    expect(titles).not.toContain('Team Secret Doc');
  });

  test('should enforce visibility: ADMIN sees all levels', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const admin = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });

    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Admin Vis', visibility: DocumentVisibility.ADMIN },
    });
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: {
        title: 'Manager Vis',
        visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      },
    });
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Everyone Vis', visibility: DocumentVisibility.EVERYONE },
    });

    const { token: adminToken } = await createApiToken({
      userId: admin.id,
      teamId: team.id,
      tokenName: 'adminToken',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, adminToken);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Admin Vis');
    expect(titles).toContain('Manager Vis');
    expect(titles).toContain('Everyone Vis');
  });

  test('should enforce visibility: MANAGER cannot see ADMIN-only docs', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const manager = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });

    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Admin Only', visibility: DocumentVisibility.ADMIN },
    });
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: {
        title: 'Manager Visible',
        visibility: DocumentVisibility.MANAGER_AND_ABOVE,
      },
    });
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: {
        title: 'Everyone Visible',
        visibility: DocumentVisibility.EVERYONE,
      },
    });

    const { token: managerToken } = await createApiToken({
      userId: manager.id,
      teamId: team.id,
      tokenName: 'managerToken',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, managerToken);
    const titles = json!.data.map((d) => d.title);
    expect(titles).not.toContain('Admin Only');
    expect(titles).toContain('Manager Visible');
    expect(titles).toContain('Everyone Visible');
  });

  test('document owner should see their doc regardless of visibility', async ({ request }) => {
    const { team, owner } = await seedTeam();

    // Another user creates an ADMIN-only doc — owner shouldn't see it
    const admin = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
    await seedDraftDocument(admin, team.id, [], {
      createDocumentOptions: {
        title: 'Admin Created Doc',
        visibility: DocumentVisibility.ADMIN,
      },
    });

    // Owner creates their own ADMIN-only doc — should see it because they own it
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Owner ADMIN Doc', visibility: DocumentVisibility.ADMIN },
    });

    // Owner is implicitly ADMIN of their own team, so let's test with a MANAGER member
    // who owns an ADMIN-visibility doc
    const manager = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });
    await seedDraftDocument(manager, team.id, [], {
      createDocumentOptions: {
        title: 'Manager Own ADMIN Doc',
        visibility: DocumentVisibility.ADMIN,
      },
    });

    const { token: managerToken } = await createApiToken({
      userId: manager.id,
      teamId: team.id,
      tokenName: 'managerToken',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, managerToken);
    const titles = json!.data.map((d) => d.title);
    // Manager should see their own ADMIN doc (owner override)
    expect(titles).toContain('Manager Own ADMIN Doc');
    // Manager should NOT see admin's ADMIN doc (visibility restricted)
    expect(titles).not.toContain('Admin Created Doc');
  });

  test('being a recipient does not override ADMIN visibility in the API', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const manager = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });

    // Owner creates an ADMIN-only doc with manager as recipient
    await seedPendingDocument(owner, team.id, [manager], {
      createDocumentOptions: {
        title: 'ADMIN Doc With Manager Recipient',
        visibility: DocumentVisibility.ADMIN,
      },
    });

    // Owner creates another ADMIN-only doc WITHOUT manager as recipient
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: {
        title: 'ADMIN Doc Without Manager',
        visibility: DocumentVisibility.ADMIN,
      },
    });

    const { token: managerToken } = await createApiToken({
      userId: manager.id,
      teamId: team.id,
      tokenName: 'managerToken',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, managerToken);
    const titles = json!.data.map((d) => d.title);
    // Unlike findDocuments (UI), the API does not let recipient status bypass visibility
    expect(titles).not.toContain('ADMIN Doc With Manager Recipient');
    expect(titles).not.toContain('ADMIN Doc Without Manager');
  });
});

// ─── Team with Team Email ────────────────────────────────────────────────────

test.describe('Find Envelopes API - Team Email', () => {
  test('should include envelopes received by team email from external senders', async ({
    request,
  }) => {
    const { team, owner } = await seedTeam();
    const teamEmailAddr = `team-find-env-${team.id}@test.documenso.com`;
    await seedTeamEmail({ email: teamEmailAddr, teamId: team.id });

    const { user: externalUser, team: externalTeam } = await seedUser();

    // Regular team doc (should be included)
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Regular Team Doc' },
    });

    // Doc sent TO team email from external user (should be included — recipient match)
    await seedPendingDocument(externalUser, externalTeam.id, [teamEmailAddr], {
      createDocumentOptions: { title: 'Received by Team Email' },
    });

    // External noise (should NOT be included)
    const { user: externalUser2 } = await seedUser();
    await seedPendingDocument(externalUser, externalTeam.id, [externalUser2], {
      createDocumentOptions: { title: 'External Noise Doc' },
    });

    const { token } = await createApiToken({
      userId: owner.id,
      teamId: team.id,
      tokenName: 'ownerToken',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, token);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Regular Team Doc');
    expect(titles).toContain('Received by Team Email');
    expect(titles).not.toContain('External Noise Doc');
  });

  test('should NOT include external noise from other teams when team has team email', async ({
    request,
  }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const teamEmailAddr = `team-noise-${teamA.id}@test.documenso.com`;
    await seedTeamEmail({ email: teamEmailAddr, teamId: teamA.id });

    const { team: teamB, owner: ownerB } = await seedTeam();

    await seedDraftDocument(ownerA, teamA.id, [], {
      createDocumentOptions: { title: 'TeamA Doc' },
    });
    await seedDraftDocument(ownerB, teamB.id, [], {
      createDocumentOptions: { title: 'TeamB External Doc' },
    });

    const { token: tokenA } = await createApiToken({
      userId: ownerA.id,
      teamId: teamA.id,
      tokenName: 'tokenA',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, tokenA);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('TeamA Doc');
    expect(titles).not.toContain('TeamB External Doc');
  });

  test('team email received docs bypass visibility for managers', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const teamEmailAddr = `team-vis-env-${team.id}@test.documenso.com`;
    await seedTeamEmail({ email: teamEmailAddr, teamId: team.id });

    const { user: externalUser, team: externalTeam } = await seedUser();

    // External user sends ADMIN-visibility doc to team email
    await seedPendingDocument(externalUser, externalTeam.id, [teamEmailAddr], {
      createDocumentOptions: {
        title: 'External ADMIN to Team Email',
        visibility: DocumentVisibility.ADMIN,
      },
    });

    // External user sends EVERYONE-visibility doc to team email
    await seedPendingDocument(externalUser, externalTeam.id, [teamEmailAddr], {
      createDocumentOptions: {
        title: 'External EVERYONE to Team Email',
        visibility: DocumentVisibility.EVERYONE,
      },
    });

    // Regular team doc with ADMIN visibility (manager shouldn't see via visibility filter)
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: {
        title: 'Team ADMIN Doc',
        visibility: DocumentVisibility.ADMIN,
      },
    });

    const manager = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });
    const { token: managerToken } = await createApiToken({
      userId: manager.id,
      teamId: team.id,
      tokenName: 'managerToken',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, managerToken);
    const titles = json!.data.map((d) => d.title);

    // Team email recipient filter bypasses visibility — both docs visible
    expect(titles).toContain('External EVERYONE to Team Email');
    expect(titles).toContain('External ADMIN to Team Email');
    // Regular ADMIN doc should NOT be visible to manager (no bypass)
    expect(titles).not.toContain('Team ADMIN Doc');
  });
});

// ─── Adversarial / Parameter Manipulation Tests ──────────────────────────────

const trpcQuery = async (
  page: import('@playwright/test').Page,
  route: string,
  teamId: number,
  input: Record<string, unknown> = {},
) => {
  const inputParam = encodeURIComponent(JSON.stringify({ json: input }));
  const url = `${WEBAPP_BASE_URL}/api/trpc/${route}?input=${inputParam}`;

  return page.context().request.get(url, {
    headers: {
      'x-team-id': String(teamId),
    },
  });
};

test.describe('Find Envelopes API - Adversarial: x-team-id Header Spoofing', () => {
  test('should reject request when user spoofs x-team-id to a team they do not belong to', async ({
    page,
  }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    await seedDraftDocument(ownerA, teamA.id, [], {
      createDocumentOptions: { title: 'Secret TeamA Envelope' },
    });
    await seedDraftDocument(ownerB, teamB.id, [], {
      createDocumentOptions: { title: 'TeamB Envelope' },
    });

    // Sign in as ownerB (NOT a member of teamA)
    await apiSignin({ page, email: ownerB.email });

    // Spoof x-team-id to teamA
    const res = await trpcQuery(page, 'envelope.find', teamA.id, {
      page: 1,
      perPage: 100,
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should return only own team data when user provides legitimate x-team-id (positive control)', async ({
    page,
  }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    await seedDraftDocument(ownerA, teamA.id, [], {
      createDocumentOptions: { title: 'TeamA Legit Envelope' },
    });
    await seedDraftDocument(ownerB, teamB.id, [], {
      createDocumentOptions: { title: 'TeamB Legit Envelope' },
    });

    await apiSignin({ page, email: ownerA.email });

    const res = await trpcQuery(page, 'envelope.find', teamA.id, {
      page: 1,
      perPage: 100,
    });

    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const docs = data.result.data.json.data;
    const titles = docs.map((d: { title: string }) => d.title);
    expect(titles).toContain('TeamA Legit Envelope');
    expect(titles).not.toContain('TeamB Legit Envelope');
  });

  test('member of TeamA should not access TeamB via x-team-id', async ({ page }) => {
    const { team: teamA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    const member = await seedTeamMember({ teamId: teamA.id, role: TeamMemberRole.ADMIN });

    await seedDraftDocument(ownerB, teamB.id, [], {
      createDocumentOptions: { title: 'TeamB Secret' },
    });

    await apiSignin({ page, email: member.email });

    const res = await trpcQuery(page, 'envelope.find', teamB.id);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });
});

test.describe('Find Envelopes API - Adversarial: Cross-Team folderId', () => {
  test('should NOT return envelopes from another team when folderId belongs to that team', async ({
    request,
  }) => {
    const { user: userA, team: teamA } = await seedUser();
    const { user: userB, team: teamB } = await seedUser();

    const folderA = await prisma.folder.create({
      data: {
        name: 'TeamA Folder',
        teamId: teamA.id,
        userId: userA.id,
        type: 'DOCUMENT',
      },
    });

    const folderB = await prisma.folder.create({
      data: {
        name: 'TeamB Folder',
        teamId: teamB.id,
        userId: userB.id,
        type: 'DOCUMENT',
      },
    });

    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'TeamA Folder Env', folderId: folderA.id },
    });
    await seedDraftDocument(userB, teamB.id, [], {
      createDocumentOptions: { title: 'TeamB Folder Env', folderId: folderB.id },
    });

    const { token: tokenA } = await createApiToken({
      userId: userA.id,
      teamId: teamA.id,
      tokenName: 'tokenA',
      expiresIn: null,
    });

    // UserA tries teamB's folderId — should return empty
    const { json } = await findEnvelopes(request, tokenA, { folderId: folderB.id });
    expect(json!.data).toHaveLength(0);
    expect(json!.count).toBe(0);

    // Positive control: own folderId works
    const { json: ownFolder } = await findEnvelopes(request, tokenA, { folderId: folderA.id });
    expect(ownFolder!.data).toHaveLength(1);
    expect(ownFolder!.data[0].title).toBe('TeamA Folder Env');
  });

  test('cross-team folderId via session/tRPC should also return empty', async ({ page }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    const folderB = await prisma.folder.create({
      data: {
        name: 'Target Folder',
        teamId: teamB.id,
        userId: ownerB.id,
        type: 'DOCUMENT',
      },
    });

    await seedDraftDocument(ownerB, teamB.id, [], {
      createDocumentOptions: { title: 'Target Folder Env', folderId: folderB.id },
    });

    await apiSignin({ page, email: ownerA.email });

    const res = await trpcQuery(page, 'envelope.find', teamA.id, {
      folderId: folderB.id,
      page: 1,
      perPage: 100,
    });

    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const docs = data.result.data.json.data;
    expect(docs).toHaveLength(0);
  });
});

test.describe('Find Envelopes API - Adversarial: Cross-Team templateId', () => {
  test('should NOT return envelopes from another team when filtering by their templateId', async ({
    request,
  }) => {
    const { user: userA, team: teamA } = await seedUser();
    const { user: userB, team: teamB } = await seedUser();

    const fakeTemplateId = 888777;
    const ownTemplateId = 888666;

    await seedDraftDocument(userB, teamB.id, [], {
      createDocumentOptions: { title: 'TeamB Template Env', templateId: fakeTemplateId },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'TeamA Template Env', templateId: ownTemplateId },
    });

    const { token: tokenA } = await createApiToken({
      userId: userA.id,
      teamId: teamA.id,
      tokenName: 'tokenA',
      expiresIn: null,
    });

    // UserA tries teamB's templateId — should return empty
    const { json } = await findEnvelopes(request, tokenA, {
      templateId: String(fakeTemplateId),
    });
    expect(json!.data).toHaveLength(0);
    expect(json!.count).toBe(0);

    // Positive control: own templateId works
    const { json: ownTemplate } = await findEnvelopes(request, tokenA, {
      templateId: String(ownTemplateId),
    });
    expect(ownTemplate!.data).toHaveLength(1);
    expect(ownTemplate!.data[0].title).toBe('TeamA Template Env');
  });
});

// ─── Personal vs Team Isolation ──────────────────────────────────────────────

test.describe('Find Envelopes API - Cross-User Isolation', () => {
  test('other users personal envelopes should never appear regardless of context', async ({
    request,
  }) => {
    const { team } = await seedTeam();
    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
    const { user: outsider, team: outsiderTeam } = await seedUser();

    // Outsider creates personal doc
    await seedDraftDocument(outsider, outsiderTeam.id, [], {
      createDocumentOptions: { title: 'Outsider Personal Env' },
    });

    // Member creates team doc
    await seedDraftDocument(member, team.id, [], {
      createDocumentOptions: { title: 'Team Env' },
    });

    // Query with team token — outsider's doc should never appear
    const { token: teamToken } = await createApiToken({
      userId: member.id,
      teamId: team.id,
      tokenName: 'teamToken',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, teamToken);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Team Env');
    expect(titles).not.toContain('Outsider Personal Env');
  });

  // Regression test: Same { userId } OR clause issue — user's team docs leaked into personal
  // context. Fixed in the Kysely refactor.
  test('team envelopes should not appear in personal context', async ({ request }) => {
    const { team: orgTeam } = await seedTeam();
    // Add a member — seedTeamMember creates a separate user with their own personal team
    const member = await seedTeamMember({ teamId: orgTeam.id, role: TeamMemberRole.ADMIN });

    // Find the member's personal team
    const memberOrg = await prisma.organisation.findFirstOrThrow({
      where: { ownerUserId: member.id },
      include: { teams: true },
    });
    const memberPersonalTeamId = memberOrg.teams[0].id;

    // Member creates a doc on the org team
    await seedDraftDocument(member, orgTeam.id, [], {
      createDocumentOptions: { title: 'Member Org Team Env' },
    });

    // Member creates a doc on their personal team
    await seedDraftDocument(member, memberPersonalTeamId, [], {
      createDocumentOptions: { title: 'Member Personal Env' },
    });

    // Query with member's personal team token
    const { token: personalToken } = await createApiToken({
      userId: member.id,
      teamId: memberPersonalTeamId,
      tokenName: 'personalToken',
      expiresIn: null,
    });

    const { json } = await findEnvelopes(request, personalToken);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Member Personal Env');
    // Org team doc should NOT appear in personal context
    expect(titles).not.toContain('Member Org Team Env');
  });
});
