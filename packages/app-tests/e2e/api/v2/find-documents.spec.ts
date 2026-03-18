import { expect, test } from '@playwright/test';
import type { Team, User } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { createApiToken } from '@documenso/lib/server-only/public-api/create-api-token';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, DocumentVisibility, TeamMemberRole } from '@documenso/prisma/client';
import {
  seedBlankDocument,
  seedCompletedDocument,
  seedDocuments,
  seedDraftDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamEmail, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import type { TFindDocumentsResponse } from '@documenso/trpc/server/document-router/find-documents.types';

import { apiSignin } from '../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();
const baseUrl = `${WEBAPP_BASE_URL}/api/v2`;

test.describe.configure({
  mode: 'parallel',
});

// Helper to make authenticated GET requests to the find documents endpoint.
const findDocuments = async (
  request: import('@playwright/test').APIRequestContext,
  token: string,
  params: Record<string, string> = {},
) => {
  const searchParams = new URLSearchParams(params);
  const url = `${baseUrl}/document${searchParams.toString() ? `?${searchParams.toString()}` : ''}`;

  const res = await request.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });

  return {
    res,
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    json: res.ok() ? ((await res.json()) as TFindDocumentsResponse) : null,
  };
};

test.describe('Find Documents API - Personal Context', () => {
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

  test('should return empty results when no documents exist', async ({ request }) => {
    const { res, json } = await findDocuments(request, tokenA);

    expect(res.ok()).toBeTruthy();
    expect(json).toBeDefined();
    expect(json!.data).toHaveLength(0);
    expect(json!.count).toBe(0);
    expect(json!.currentPage).toBe(1);
    expect(json!.totalPages).toBe(0);
  });

  test('should return only documents owned by the user and not the other user', async ({
    request,
  }) => {
    // The v2 API token scopes to a team. A personal team token only returns
    // docs belonging to that team — cross-team received docs are NOT included.
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'UserA Draft 1' },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'UserA Draft 2' },
    });
    await seedPendingDocument(userA, teamA.id, [userB], {
      createDocumentOptions: { title: 'UserA Pending' },
    });

    await seedDraftDocument(userB, teamB.id, [], {
      createDocumentOptions: { title: 'UserB Draft 1' },
    });
    await seedPendingDocument(userB, teamB.id, [userA], {
      createDocumentOptions: { title: 'UserB Pending' },
    });
    await seedCompletedDocument(userB, teamB.id, [userA], {
      createDocumentOptions: { title: 'UserB Completed' },
    });

    const { json: jsonA } = await findDocuments(request, tokenA);
    const { json: jsonB } = await findDocuments(request, tokenB);

    const titlesA = jsonA!.data.map((d) => d.title);
    // UserA sees only their own team's docs
    expect(titlesA).toContain('UserA Draft 1');
    expect(titlesA).toContain('UserA Draft 2');
    expect(titlesA).toContain('UserA Pending');
    // Cross-team received docs are NOT visible via personal team token
    expect(titlesA).not.toContain('UserB Pending');
    expect(titlesA).not.toContain('UserB Completed');
    expect(titlesA).not.toContain('UserB Draft 1');
    expect(jsonA!.count).toBe(3);

    const titlesB = jsonB!.data.map((d) => d.title);
    expect(titlesB).toContain('UserB Draft 1');
    expect(titlesB).toContain('UserB Pending');
    expect(titlesB).toContain('UserB Completed');
    expect(titlesB).not.toContain('UserA Draft 1');
    expect(titlesB).not.toContain('UserA Draft 2');
    expect(titlesB).not.toContain('UserA Pending');
    expect(jsonB!.count).toBe(3);
  });

  test('should only return documents belonging to the personal team, not cross-team received docs', async ({
    request,
  }) => {
    // The v2 API scopes to a team. Cross-team docs where the user is a recipient
    // are NOT returned — they belong to the sender's team, not the recipient's.
    await seedPendingDocument(userB, teamB.id, [userA], {
      createDocumentOptions: { title: 'Pending for A from B Team' },
    });
    await seedCompletedDocument(userB, teamB.id, [userA], {
      createDocumentOptions: { title: 'Completed for A from B Team' },
    });

    // UserA's own docs (should be returned)
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'UserA Own Draft' },
    });
    await seedPendingDocument(userA, teamA.id, [userB], {
      createDocumentOptions: { title: 'UserA Own Pending' },
    });

    const { json } = await findDocuments(request, tokenA);
    const titles = json!.data.map((d) => d.title);

    expect(titles).toContain('UserA Own Draft');
    expect(titles).toContain('UserA Own Pending');
    // Cross-team received docs NOT visible
    expect(titles).not.toContain('Pending for A from B Team');
    expect(titles).not.toContain('Completed for A from B Team');
    expect(json!.count).toBe(2);
  });

  test('should NOT leak documents between unrelated users', async ({ request }) => {
    const { user: userC, team: teamC } = await seedUser();

    // Each user has their own docs
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'UserA Own Doc' },
    });

    await seedDraftDocument(userB, teamB.id, [], {
      createDocumentOptions: { title: 'UserB Own Doc' },
    });

    await seedDraftDocument(userC, teamC.id, [], {
      createDocumentOptions: { title: 'UserC Private Draft' },
    });
    await seedPendingDocument(userC, teamC.id, [userC], {
      createDocumentOptions: { title: 'UserC Pending' },
    });
    await seedCompletedDocument(userC, teamC.id, [userC], {
      createDocumentOptions: { title: 'UserC Completed' },
    });

    const { json: jsonA } = await findDocuments(request, tokenA);
    const { json: jsonB } = await findDocuments(request, tokenB);

    // UserA should see only their own doc
    expect(jsonA!.data).toHaveLength(1);
    expect(jsonA!.data[0].title).toBe('UserA Own Doc');

    // UserB should see only their own doc
    expect(jsonB!.data).toHaveLength(1);
    expect(jsonB!.data[0].title).toBe('UserB Own Doc');
  });

  test('should filter by status correctly across all statuses', async ({ request }) => {
    const { user: userC } = await seedUser();

    // Seed all three statuses with 2 docs each plus noise from received docs
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Draft 1' },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Draft 2' },
    });
    await seedPendingDocument(userA, teamA.id, [userB], {
      createDocumentOptions: { title: 'Pending 1' },
    });
    await seedPendingDocument(userA, teamA.id, [userC], {
      createDocumentOptions: { title: 'Pending 2' },
    });
    await seedCompletedDocument(userA, teamA.id, [userB], {
      createDocumentOptions: { title: 'Completed 1' },
    });
    await seedCompletedDocument(userA, teamA.id, [userC], {
      createDocumentOptions: { title: 'Completed 2' },
    });

    const { json: draftResults } = await findDocuments(request, tokenA, { status: 'DRAFT' });
    expect(draftResults!.data).toHaveLength(2);
    expect(draftResults!.data.every((d) => d.status === DocumentStatus.DRAFT)).toBe(true);

    const { json: pendingResults } = await findDocuments(request, tokenA, { status: 'PENDING' });
    expect(pendingResults!.data).toHaveLength(2);
    expect(pendingResults!.data.every((d) => d.status === DocumentStatus.PENDING)).toBe(true);

    const { json: completedResults } = await findDocuments(request, tokenA, {
      status: 'COMPLETED',
    });
    expect(completedResults!.data).toHaveLength(2);
    expect(completedResults!.data.every((d) => d.status === DocumentStatus.COMPLETED)).toBe(true);
  });

  test('should paginate correctly', async ({ request }) => {
    // Create 5 documents
    for (let i = 0; i < 5; i++) {
      await seedDraftDocument(userA, teamA.id, [], {
        createDocumentOptions: { title: `Paginated Doc ${i}` },
      });
    }

    // Also seed noise docs for userB to ensure isolation across pages
    for (let i = 0; i < 3; i++) {
      await seedDraftDocument(userB, teamB.id, [], {
        createDocumentOptions: { title: `UserB Noise Doc ${i}` },
      });
    }

    const { json: page1 } = await findDocuments(request, tokenA, { page: '1', perPage: '2' });
    expect(page1!.data).toHaveLength(2);
    expect(page1!.count).toBe(5);
    expect(page1!.currentPage).toBe(1);
    expect(page1!.totalPages).toBe(3);
    expect(page1!.perPage).toBe(2);

    const { json: page2 } = await findDocuments(request, tokenA, { page: '2', perPage: '2' });
    expect(page2!.data).toHaveLength(2);
    expect(page2!.currentPage).toBe(2);

    const { json: page3 } = await findDocuments(request, tokenA, { page: '3', perPage: '2' });
    expect(page3!.data).toHaveLength(1);
    expect(page3!.currentPage).toBe(3);

    // Ensure no duplicates across pages and no B docs leaked
    const allTitles = [
      ...page1!.data.map((d) => d.title),
      ...page2!.data.map((d) => d.title),
      ...page3!.data.map((d) => d.title),
    ];
    const uniqueTitles = new Set(allTitles);
    expect(uniqueTitles.size).toBe(5);
    expect(allTitles.every((t) => t.startsWith('Paginated Doc'))).toBe(true);
  });

  test('should search by document title and exclude non-matching docs', async ({ request }) => {
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Quarterly Report 2024' },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Annual Budget Plan' },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Monthly Summary' },
    });

    const { json } = await findDocuments(request, tokenA, { query: 'Quarterly' });
    expect(json!.data).toHaveLength(1);
    expect(json!.data[0].title).toBe('Quarterly Report 2024');
  });

  test('should search by recipient email and not return docs with different recipients', async ({
    request,
  }) => {
    const { user: userC } = await seedUser();

    await seedPendingDocument(userA, teamA.id, [userB], {
      createDocumentOptions: { title: 'Doc with Recipient B' },
    });
    await seedPendingDocument(userA, teamA.id, [userC], {
      createDocumentOptions: { title: 'Doc with Recipient C' },
    });
    await seedPendingDocument(userA, teamA.id, [userB, userC], {
      createDocumentOptions: { title: 'Doc with Both Recipients' },
    });

    const { json } = await findDocuments(request, tokenA, { query: userB.email });
    // Should find the doc with B and the doc with both, but not the doc with only C
    expect(json!.data).toHaveLength(2);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Doc with Recipient B');
    expect(titles).toContain('Doc with Both Recipients');
    expect(titles).not.toContain('Doc with Recipient C');
  });

  test('should search case-insensitively', async ({ request }) => {
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Important Contract' },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Other Document' },
    });

    const { json: lowerCase } = await findDocuments(request, tokenA, {
      query: 'important contract',
    });
    expect(lowerCase!.data).toHaveLength(1);
    expect(lowerCase!.data[0].title).toBe('Important Contract');

    const { json: upperCase } = await findDocuments(request, tokenA, {
      query: 'IMPORTANT CONTRACT',
    });
    expect(upperCase!.data).toHaveLength(1);
    expect(upperCase!.data[0].title).toBe('Important Contract');
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
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Third Created' },
    });

    const { json } = await findDocuments(request, tokenA);
    expect(json!.data).toHaveLength(3);
    expect(json!.data[0].title).toBe('Third Created');
    expect(json!.data[1].title).toBe('Second Created');
    expect(json!.data[2].title).toBe('First Created');
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
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Third Created' },
    });

    const { json } = await findDocuments(request, tokenA, {
      orderByColumn: 'createdAt',
      orderByDirection: 'asc',
    });

    expect(json!.data[0].title).toBe('First Created');
    expect(json!.data[1].title).toBe('Second Created');
    expect(json!.data[2].title).toBe('Third Created');
  });

  test('owner should see all recipient tokens on their documents', async ({ request }) => {
    // Full token masking (non-owner sees masked tokens) can't be tested via API
    // since only ADMIN/MANAGER can create tokens and they have full visibility.
    // This test verifies the owner sees all tokens; masking is tested in the UI file.
    const { user: recipient1 } = await seedUser();
    const { user: recipient2 } = await seedUser();

    await seedPendingDocument(userA, teamA.id, [recipient1, recipient2], {
      createDocumentOptions: { title: 'Token Visibility Test' },
    });

    const { json } = await findDocuments(request, tokenA);
    const doc = json!.data.find((d) => d.title === 'Token Visibility Test');
    expect(doc).toBeDefined();
    expect(doc!.recipients.length).toBe(2);
    // Owner should see all recipient tokens (not masked)
    for (const r of doc!.recipients) {
      expect(r.token).not.toBe('');
    }
  });

  test('should only show root-level documents when no folderId is provided', async ({
    request,
  }) => {
    const folder = await prisma.folder.create({
      data: {
        name: 'Test Folder',
        teamId: teamA.id,
        userId: userA.id,
        type: 'DOCUMENT',
      },
    });

    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Root Document 1', folderId: null },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Root Document 2', folderId: null },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Foldered Document 1', folderId: folder.id },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Foldered Document 2', folderId: folder.id },
    });

    const { json } = await findDocuments(request, tokenA);
    expect(json!.count).toBe(2);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Root Document 1');
    expect(titles).toContain('Root Document 2');
    expect(titles).not.toContain('Foldered Document 1');
    expect(titles).not.toContain('Foldered Document 2');
  });

  test('should filter by folderId and not show root or other folder docs', async ({ request }) => {
    const folder1 = await prisma.folder.create({
      data: {
        name: 'Folder 1',
        teamId: teamA.id,
        userId: userA.id,
        type: 'DOCUMENT',
      },
    });
    const folder2 = await prisma.folder.create({
      data: {
        name: 'Folder 2',
        teamId: teamA.id,
        userId: userA.id,
        type: 'DOCUMENT',
      },
    });

    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Root Document', folderId: null },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Folder1 Document', folderId: folder1.id },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Folder2 Document', folderId: folder2.id },
    });

    const { json } = await findDocuments(request, tokenA, { folderId: folder1.id });
    expect(json!.data).toHaveLength(1);
    expect(json!.data[0].title).toBe('Folder1 Document');
  });

  test('should return correct response schema fields', async ({ request }) => {
    await seedPendingDocument(userA, teamA.id, [userB], {
      createDocumentOptions: { title: 'Schema Check Doc' },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Schema Check Draft' },
    });

    const { json } = await findDocuments(request, tokenA);
    expect(json!.count).toBe(2);
    expect(json!.currentPage).toBeDefined();
    expect(json!.perPage).toBeDefined();
    expect(json!.totalPages).toBeDefined();

    const doc = json!.data.find((d) => d.title === 'Schema Check Doc')!;
    expect(doc.id).toBeDefined();
    expect(doc.status).toBe(DocumentStatus.PENDING);
    expect(doc.createdAt).toBeDefined();
    expect(doc.updatedAt).toBeDefined();
    expect(doc.userId).toBe(userA.id);
    expect(doc.teamId).toBe(teamA.id);
    expect(doc.user).toBeDefined();
    expect(doc.user.id).toBe(userA.id);
    expect(doc.user.email).toBe(userA.email);
    expect(doc.recipients).toHaveLength(1);
    expect(doc.recipients[0].email).toBe(userB.email);
  });

  test('should not return deleted documents but should return non-deleted ones', async ({
    request,
  }) => {
    const deletedDoc = await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Deleted Document' },
    });
    await prisma.envelope.update({
      where: { id: deletedDoc.id },
      data: { deletedAt: new Date() },
    });

    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Active Document 1' },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Active Document 2' },
    });

    const { json } = await findDocuments(request, tokenA);
    expect(json!.count).toBe(2);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Active Document 1');
    expect(titles).toContain('Active Document 2');
    expect(titles).not.toContain('Deleted Document');
  });

  test('should search by externalId', async ({ request }) => {
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: {
        title: 'External ID Doc',
        externalId: 'EXT-12345-UNIQUE',
      },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Other Doc 1' },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'Other Doc 2' },
    });

    const { json } = await findDocuments(request, tokenA, { query: 'EXT-12345-UNIQUE' });
    expect(json!.data).toHaveLength(1);
    expect(json!.data[0].title).toBe('External ID Doc');
  });

  test('should search by recipient name', async ({ request }) => {
    const { user: recipient } = await seedUser({ name: 'Unique Recipient Name' });
    const { user: otherRecipient } = await seedUser({ name: 'Other Person' });

    await seedPendingDocument(userA, teamA.id, [recipient], {
      createDocumentOptions: { title: 'Doc for Unique Person' },
    });
    await seedPendingDocument(userA, teamA.id, [otherRecipient], {
      createDocumentOptions: { title: 'Doc for Other Person' },
    });

    const { json } = await findDocuments(request, tokenA, { query: 'Unique Recipient' });
    expect(json!.data).toHaveLength(1);
    expect(json!.data[0].title).toBe('Doc for Unique Person');
  });
});

test.describe('Find Documents API - Team Context', () => {
  test('should return team documents for team members and exclude non-team docs', async ({
    request,
  }) => {
    const { team, owner } = await seedTeam();

    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
    const { user: outsideUser, team: outsideTeam } = await seedUser();

    // Team docs
    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [outsideUser],
        type: DocumentStatus.PENDING,
        documentOptions: { title: 'Team Doc 1' },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Team Doc 2' },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [outsideUser],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Team Doc 3' },
      },
    ]);

    // Non-team docs (noise - should NOT appear)
    await seedDocuments([
      {
        sender: outsideUser,
        teamId: outsideTeam.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Outside Draft' },
      },
      {
        sender: outsideUser,
        teamId: outsideTeam.id,
        recipients: [member],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Outside Completed with Member as Recipient' },
      },
    ]);

    const { token: memberToken } = await createApiToken({
      userId: member.id,
      teamId: team.id,
      tokenName: 'member-token',
      expiresIn: null,
    });

    const { json } = await findDocuments(request, memberToken);
    expect(json!.data.length).toBe(3);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Team Doc 1');
    expect(titles).toContain('Team Doc 2');
    expect(titles).toContain('Team Doc 3');
    expect(titles).not.toContain('Outside Draft');
  });

  test('should NOT leak team documents to non-members', async ({ request }) => {
    const { team, owner } = await seedTeam();
    const { user: outsideUser, team: outsideTeam } = await seedUser();

    // Team docs
    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Secret Team Draft' },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Secret Team Completed' },
      },
    ]);

    // Outside user's own docs (positive control)
    await seedDraftDocument(outsideUser, outsideTeam.id, [], {
      createDocumentOptions: { title: 'Outside Own Doc' },
    });

    const { token: outsideToken } = await createApiToken({
      userId: outsideUser.id,
      teamId: outsideTeam.id,
      tokenName: 'outside-token',
      expiresIn: null,
    });

    const { json } = await findDocuments(request, outsideToken);
    const titles = json!.data.map((d) => d.title);
    // Outside user should see their own doc but not team docs
    expect(titles).toContain('Outside Own Doc');
    expect(titles).not.toContain('Secret Team Draft');
    expect(titles).not.toContain('Secret Team Completed');
  });

  test('should NOT show documents from other teams', async ({ request }) => {
    const { team: teamX, owner: ownerX } = await seedTeam();
    const { team: teamY, owner: ownerY } = await seedTeam();

    // Multiple docs in each team
    await seedDocuments([
      {
        sender: ownerX,
        teamId: teamX.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Team X Completed' },
      },
      {
        sender: ownerX,
        teamId: teamX.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Team X Draft' },
      },
      {
        sender: ownerY,
        teamId: teamY.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Team Y Completed' },
      },
      {
        sender: ownerY,
        teamId: teamY.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Team Y Draft' },
      },
    ]);

    const { token: tokenX } = await createApiToken({
      userId: ownerX.id,
      teamId: teamX.id,
      tokenName: 'teamX-token',
      expiresIn: null,
    });

    const { json } = await findDocuments(request, tokenX);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Team X Completed');
    expect(titles).toContain('Team X Draft');
    expect(titles).not.toContain('Team Y Completed');
    expect(titles).not.toContain('Team Y Draft');
    expect(json!.count).toBe(2);
  });

  test('should enforce visibility across admin and manager levels with adequate data', async ({
    request,
  }) => {
    // Note: MEMBER role cannot create API tokens (requires MANAGE_TEAM permission).
    // MEMBER visibility is tested in the UI test file instead.
    const { team, owner } = await seedTeam();

    const admin = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
    const manager = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });

    // Seed 2 docs per visibility level (6 total)
    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Everyone Doc 1', visibility: DocumentVisibility.EVERYONE },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Everyone Doc 2', visibility: DocumentVisibility.EVERYONE },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Manager Doc 1',
          visibility: DocumentVisibility.MANAGER_AND_ABOVE,
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Manager Doc 2',
          visibility: DocumentVisibility.MANAGER_AND_ABOVE,
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Admin Doc 1', visibility: DocumentVisibility.ADMIN },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Admin Doc 2', visibility: DocumentVisibility.ADMIN },
      },
    ]);

    // Admin sees all 6
    const { token: adminToken } = await createApiToken({
      userId: admin.id,
      teamId: team.id,
      tokenName: 'admin-token',
      expiresIn: null,
    });
    const { json: adminJson } = await findDocuments(request, adminToken);
    expect(adminJson!.count).toBe(6);

    // Manager sees 4 (Everyone + Manager)
    const { token: managerToken } = await createApiToken({
      userId: manager.id,
      teamId: team.id,
      tokenName: 'manager-token',
      expiresIn: null,
    });
    const { json: managerJson } = await findDocuments(request, managerToken);
    expect(managerJson!.count).toBe(4);
    const managerTitles = managerJson!.data.map((d) => d.title);
    expect(managerTitles).toContain('Everyone Doc 1');
    expect(managerTitles).toContain('Manager Doc 1');
    expect(managerTitles).not.toContain('Admin Doc 1');
  });

  test('document owner should see their document regardless of visibility even when other restricted docs are hidden', async ({
    request,
  }) => {
    const { team, owner } = await seedTeam();

    // Use MANAGER (can create tokens but can't see ADMIN-vis docs by default)
    const manager = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });

    // Manager creates an ADMIN-only doc (they should still see it as owner)
    // Owner creates an ADMIN-only doc (manager should NOT see this one)
    await seedDocuments([
      {
        sender: manager,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Manager Owned Admin Vis',
          visibility: DocumentVisibility.ADMIN,
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Owner Admin Vis (hidden from manager)',
          visibility: DocumentVisibility.ADMIN,
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Everyone Vis Control',
          visibility: DocumentVisibility.EVERYONE,
        },
      },
    ]);

    const { token: managerToken } = await createApiToken({
      userId: manager.id,
      teamId: team.id,
      tokenName: 'manager-token',
      expiresIn: null,
    });

    const { json } = await findDocuments(request, managerToken);
    const titles = json!.data.map((d) => d.title);
    // Manager sees their own ADMIN doc + EVERYONE + MANAGER_AND_ABOVE docs, but NOT the owner's ADMIN doc
    expect(titles).toContain('Manager Owned Admin Vis');
    expect(titles).toContain('Everyone Vis Control');
    expect(titles).not.toContain('Owner Admin Vis (hidden from manager)');
  });

  test('recipient should see document regardless of visibility even when other restricted docs are hidden', async ({
    request,
  }) => {
    const { team, owner } = await seedTeam();

    // Use MANAGER (can create tokens but can't see ADMIN-vis docs by default)
    const manager = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });

    // Admin doc with manager as recipient (manager should see despite ADMIN visibility)
    // Admin doc WITHOUT manager as recipient (manager should NOT see)
    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [manager],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Admin Doc with Manager Recipient',
          visibility: DocumentVisibility.ADMIN,
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Admin Doc without Manager',
          visibility: DocumentVisibility.ADMIN,
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Everyone Doc Control',
          visibility: DocumentVisibility.EVERYONE,
        },
      },
    ]);

    const { token: managerToken } = await createApiToken({
      userId: manager.id,
      teamId: team.id,
      tokenName: 'manager-token',
      expiresIn: null,
    });

    const { json } = await findDocuments(request, managerToken);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Admin Doc with Manager Recipient');
    expect(titles).toContain('Everyone Doc Control');
    expect(titles).not.toContain('Admin Doc without Manager');
  });
});

test.describe('Find Documents API - Team with Team Email', () => {
  test('should show documents sent by team email and received by team email, but not external noise', async ({
    request,
  }) => {
    const { team, owner } = await seedTeam();

    const teamEmail = `team-email-${team.id}@test.documenso.com`;
    await seedTeamEmail({ email: teamEmail, teamId: team.id });

    const { user: externalUser, team: externalTeam } = await seedUser();
    const { user: externalUser2, team: externalTeam2 } = await seedUser();

    // Doc owned by team
    await seedPendingDocument(owner, team.id, [externalUser], {
      createDocumentOptions: { title: 'Team Owned Pending' },
    });

    // Doc sent TO team email (external sender)
    await seedPendingDocument(externalUser, externalTeam.id, [teamEmail], {
      createDocumentOptions: { title: 'Received by Team Email' },
    });
    await seedCompletedDocument(externalUser, externalTeam.id, [teamEmail], {
      createDocumentOptions: { title: 'Completed for Team Email' },
    });

    // Draft sent to team email (should NOT show)
    await seedDraftDocument(externalUser2, externalTeam2.id, [teamEmail], {
      createDocumentOptions: { title: 'Draft To Team Email (hidden)' },
    });

    // Doc between two external users (noise)
    await seedPendingDocument(externalUser, externalTeam.id, [externalUser2], {
      createDocumentOptions: { title: 'External Noise Doc' },
    });

    const admin = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
    const { token: adminToken } = await createApiToken({
      userId: admin.id,
      teamId: team.id,
      tokenName: 'admin-token',
      expiresIn: null,
    });

    const { json } = await findDocuments(request, adminToken);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Team Owned Pending');
    expect(titles).toContain('Received by Team Email');
    expect(titles).toContain('Completed for Team Email');
    expect(titles).not.toContain('Draft To Team Email (hidden)');
    expect(titles).not.toContain('External Noise Doc');
  });

  test('team email documents should respect visibility rules with adequate controls', async ({
    request,
  }) => {
    const { team } = await seedTeam();

    const teamEmail = `team-vis-email-${team.id}@test.documenso.com`;
    await seedTeamEmail({ email: teamEmail, teamId: team.id });

    const admin = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
    const manager = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });
    const { user: externalUser, team: externalTeam } = await seedUser();

    // External user sends admin-only doc to team email
    await seedPendingDocument(externalUser, externalTeam.id, [teamEmail], {
      createDocumentOptions: {
        title: 'Admin Email Doc',
        visibility: DocumentVisibility.ADMIN,
      },
    });

    // External user sends everyone-visible doc to team email
    await seedPendingDocument(externalUser, externalTeam.id, [teamEmail], {
      createDocumentOptions: {
        title: 'Everyone Email Doc',
        visibility: DocumentVisibility.EVERYONE,
      },
    });

    // Admin should see both
    const { token: adminToken } = await createApiToken({
      userId: admin.id,
      teamId: team.id,
      tokenName: 'admin-token',
      expiresIn: null,
    });
    const { json: adminJson } = await findDocuments(request, adminToken);
    const adminTitles = adminJson!.data.map((d) => d.title);
    expect(adminTitles).toContain('Admin Email Doc');
    expect(adminTitles).toContain('Everyone Email Doc');

    // Manager should see both (Everyone + Manager_and_above, and ADMIN email doc should not be visible)
    const { token: managerToken } = await createApiToken({
      userId: manager.id,
      teamId: team.id,
      tokenName: 'manager-token',
      expiresIn: null,
    });
    const { json: managerJson } = await findDocuments(request, managerToken);
    const managerTitles = managerJson!.data.map((d) => d.title);
    expect(managerTitles).toContain('Everyone Email Doc');
    expect(managerTitles).not.toContain('Admin Email Doc');
  });
});

test.describe('Find Documents API - Deleted Document Handling', () => {
  test('should not show soft-deleted documents for owner but show non-deleted ones', async ({
    request,
  }) => {
    const { user, team } = await seedUser();

    const deletedDoc = await seedPendingDocument(user, team.id, [], {
      createDocumentOptions: { title: 'Soft Deleted by Owner' },
    });
    await prisma.envelope.update({
      where: { id: deletedDoc.id },
      data: { deletedAt: new Date() },
    });

    await seedPendingDocument(user, team.id, [], {
      createDocumentOptions: { title: 'Still Active Doc 1' },
    });
    await seedDraftDocument(user, team.id, [], {
      createDocumentOptions: { title: 'Still Active Doc 2' },
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'token',
      expiresIn: null,
    });

    const { json } = await findDocuments(request, token);
    expect(json!.count).toBe(2);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Still Active Doc 1');
    expect(titles).toContain('Still Active Doc 2');
    expect(titles).not.toContain('Soft Deleted by Owner');
  });

  test('should not show documents where owner soft-deleted their copy in personal context', async ({
    request,
  }) => {
    // In personal context, documentDeletedAt on recipient hides the doc for that user.
    // Note: the v2 API scopes to a team, so we test this by having the owner
    // soft-delete a doc from their own personal team.
    const { user, team } = await seedUser();

    const deletedDoc = await seedDraftDocument(user, team.id, [], {
      createDocumentOptions: { title: 'Owner Soft Deleted' },
    });
    await prisma.envelope.update({
      where: { id: deletedDoc.id },
      data: { deletedAt: new Date() },
    });

    // Non-deleted doc (positive control)
    await seedDraftDocument(user, team.id, [], {
      createDocumentOptions: { title: 'Owner Active Doc' },
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'token',
      expiresIn: null,
    });

    const { json } = await findDocuments(request, token);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Owner Active Doc');
    expect(titles).not.toContain('Owner Soft Deleted');
  });

  test('should not show deleted team documents for any team member but show non-deleted ones', async ({
    request,
  }) => {
    const { team, owner } = await seedTeam();
    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });

    const deletedDoc = await seedBlankDocument(owner, team.id, {
      createDocumentOptions: { title: 'Deleted Team Doc' },
    });
    await prisma.envelope.update({
      where: { id: deletedDoc.id },
      data: { deletedAt: new Date() },
    });

    await seedBlankDocument(owner, team.id, {
      createDocumentOptions: { title: 'Active Team Doc 1' },
    });
    await seedBlankDocument(owner, team.id, {
      createDocumentOptions: { title: 'Active Team Doc 2' },
    });

    const { token: memberToken } = await createApiToken({
      userId: member.id,
      teamId: team.id,
      tokenName: 'member-token',
      expiresIn: null,
    });

    const { json } = await findDocuments(request, memberToken);
    expect(json!.count).toBe(2);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Active Team Doc 1');
    expect(titles).toContain('Active Team Doc 2');
    expect(titles).not.toContain('Deleted Team Doc');
  });
});

test.describe('Find Documents API - Edge Cases', () => {
  test('should handle empty search query gracefully', async ({ request }) => {
    const { user, team } = await seedUser();

    await seedDraftDocument(user, team.id, [], {
      createDocumentOptions: { title: 'Test Doc 1' },
    });
    await seedDraftDocument(user, team.id, [], {
      createDocumentOptions: { title: 'Test Doc 2' },
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'token',
      expiresIn: null,
    });

    const { json } = await findDocuments(request, token, { query: '' });
    expect(json!.data).toHaveLength(2);
  });

  test('should handle page beyond total pages', async ({ request }) => {
    const { user, team } = await seedUser();

    await seedDraftDocument(user, team.id, [], {
      createDocumentOptions: { title: 'Single Doc' },
    });

    const { token } = await createApiToken({
      userId: user.id,
      teamId: team.id,
      tokenName: 'token',
      expiresIn: null,
    });

    const { json } = await findDocuments(request, token, { page: '999', perPage: '10' });
    expect(json!.data).toHaveLength(0);
    expect(json!.count).toBe(1);
    expect(json!.totalPages).toBe(1);
  });

  test('should reject unauthenticated requests', async ({ request }) => {
    const res = await request.get(`${baseUrl}/document`, {
      headers: {},
    });

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });

  test('should reject invalid API tokens', async ({ request }) => {
    const res = await request.get(`${baseUrl}/document`, {
      headers: { Authorization: 'Bearer invalid_token_here' },
    });

    expect(res.ok()).toBeFalsy();
  });

  test('personal documents should not appear in team context even with adequate team data', async ({
    request,
  }) => {
    const { team, owner } = await seedTeam();

    const teamMember = await seedTeamMember({
      teamId: team.id,
      role: TeamMemberRole.ADMIN,
    });

    // Find member's personal team (seedUser creates an org with ownerUserId set)
    const teamMemberOrg = await prisma.organisation.findFirstOrThrow({
      where: {
        ownerUserId: teamMember.id,
      },
      include: {
        teams: true,
      },
    });

    const memberPersonalTeamId = teamMemberOrg.teams[0].id;

    // Multiple personal docs
    await seedDraftDocument(teamMember, memberPersonalTeamId, [], {
      createDocumentOptions: { title: 'Personal Doc 1' },
    });
    await seedDraftDocument(teamMember, memberPersonalTeamId, [], {
      createDocumentOptions: { title: 'Personal Doc 2' },
    });

    // Multiple team docs
    await seedDraftDocument(teamMember, team.id, [], {
      createDocumentOptions: { title: 'Team Doc by Member 1' },
    });
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Team Doc by Owner' },
    });

    const { token: teamToken } = await createApiToken({
      userId: owner.id,
      teamId: team.id,
      tokenName: 'team-token',
      expiresIn: null,
    });

    const { json } = await findDocuments(request, teamToken);
    const titles = json!.data.map((d) => d.title);
    expect(titles).toContain('Team Doc by Member 1');
    expect(titles).toContain('Team Doc by Owner');
    expect(titles).not.toContain('Personal Doc 1');
    expect(titles).not.toContain('Personal Doc 2');
    expect(json!.count).toBe(2);
  });
});

// ─── Adversarial / Parameter Manipulation Tests ──────────────────────────────
// These tests target attack vectors where an authenticated user attempts to
// access data they shouldn't by manipulating request parameters.
// Session-based tests hit the tRPC endpoint with GET (queries require GET, not POST)
// and pass the x-team-id header to simulate header spoofing.

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

test.describe('Find Documents API - Adversarial: x-team-id Header Spoofing', () => {
  test('should reject request when user spoofs x-team-id to a team they do not belong to', async ({
    page,
  }) => {
    // Setup: two separate teams with documents
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    await seedDraftDocument(ownerA, teamA.id, [], {
      createDocumentOptions: { title: 'Secret TeamA Doc 1' },
    });
    await seedDraftDocument(ownerA, teamA.id, [], {
      createDocumentOptions: { title: 'Secret TeamA Doc 2' },
    });
    await seedDraftDocument(ownerB, teamB.id, [], {
      createDocumentOptions: { title: 'TeamB Own Doc' },
    });

    // Sign in as ownerB (who has NO access to teamA)
    await apiSignin({ page, email: ownerB.email });

    // Attempt to query findDocumentsInternal with x-team-id pointing to teamA
    const res = await trpcQuery(page, 'document.findDocumentsInternal', teamA.id, {
      page: 1,
      perPage: 100,
    });

    // Should be rejected — ownerB is not a member of teamA
    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });

  test('should return only own team data when user provides their legitimate x-team-id (positive control)', async ({
    page,
  }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    await seedDraftDocument(ownerA, teamA.id, [], {
      createDocumentOptions: { title: 'TeamA Legit Doc' },
    });
    await seedDraftDocument(ownerB, teamB.id, [], {
      createDocumentOptions: { title: 'TeamB Legit Doc' },
    });

    // Sign in as ownerA
    await apiSignin({ page, email: ownerA.email });

    // Query with legitimate x-team-id
    const res = await trpcQuery(page, 'document.findDocumentsInternal', teamA.id, {
      page: 1,
      perPage: 100,
    });

    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const docs = data.result.data.json.data;
    const titles = docs.map((d: { title: string }) => d.title);
    expect(titles).toContain('TeamA Legit Doc');
    expect(titles).not.toContain('TeamB Legit Doc');
  });

  test('team member should not access another team via x-team-id even if they belong to a different team', async ({
    page,
  }) => {
    // User belongs to teamA but NOT teamB — tries to access teamB via header
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    const member = await seedTeamMember({ teamId: teamA.id, role: TeamMemberRole.ADMIN });

    await seedDraftDocument(ownerB, teamB.id, [], {
      createDocumentOptions: { title: 'TeamB Secret' },
    });
    await seedDraftDocument(ownerA, teamA.id, [], {
      createDocumentOptions: { title: 'TeamA Doc' },
    });

    // Sign in as member (belongs to teamA only)
    await apiSignin({ page, email: member.email });

    // Attempt to access teamB
    const res = await trpcQuery(page, 'document.findDocumentsInternal', teamB.id);

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(404);
  });
});

test.describe('Find Documents API - Adversarial: Cross-Team folderId', () => {
  test('should NOT return documents from another team when folderId belongs to that team', async ({
    request,
  }) => {
    // Setup: two teams each with a folder and documents
    const { user: userA, team: teamA } = await seedUser();
    const { user: userB, team: teamB } = await seedUser();

    const folderA = await prisma.folder.create({
      data: {
        name: 'Team A Folder',
        teamId: teamA.id,
        userId: userA.id,
        type: 'DOCUMENT',
      },
    });

    const folderB = await prisma.folder.create({
      data: {
        name: 'Team B Folder',
        teamId: teamB.id,
        userId: userB.id,
        type: 'DOCUMENT',
      },
    });

    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'TeamA Folder Doc', folderId: folderA.id },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'TeamA Root Doc' },
    });
    await seedDraftDocument(userB, teamB.id, [], {
      createDocumentOptions: { title: 'TeamB Folder Doc', folderId: folderB.id },
    });

    const { token: tokenA } = await createApiToken({
      userId: userA.id,
      teamId: teamA.id,
      tokenName: 'tokenA',
      expiresIn: null,
    });

    // UserA tries to query with teamB's folderId — should return empty, not teamB's docs
    const { json } = await findDocuments(request, tokenA, { folderId: folderB.id });
    expect(json!.data).toHaveLength(0);
    expect(json!.count).toBe(0);

    // Positive control: querying own folder works
    const { json: ownFolder } = await findDocuments(request, tokenA, { folderId: folderA.id });
    expect(ownFolder!.data).toHaveLength(1);
    expect(ownFolder!.data[0].title).toBe('TeamA Folder Doc');
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
      createDocumentOptions: { title: 'Folder Target Doc', folderId: folderB.id },
    });

    // Sign in as ownerA, request with own team but teamB's folderId
    await apiSignin({ page, email: ownerA.email });

    const res = await trpcQuery(page, 'document.findDocumentsInternal', teamA.id, {
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

test.describe('Find Documents API - Adversarial: Cross-Team senderIds', () => {
  test('should NOT return documents when senderIds contains users from another team', async ({
    page,
  }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    // Both teams have documents
    await seedDraftDocument(ownerA, teamA.id, [], {
      createDocumentOptions: { title: 'TeamA Doc by OwnerA' },
    });
    await seedDraftDocument(ownerB, teamB.id, [], {
      createDocumentOptions: { title: 'TeamB Doc by OwnerB' },
    });

    // Sign in as ownerA, try to use senderIds with ownerB's userId
    await apiSignin({ page, email: ownerA.email });

    const res = await trpcQuery(page, 'document.findDocumentsInternal', teamA.id, {
      senderIds: [ownerB.id],
      page: 1,
      perPage: 100,
    });

    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const docs = data.result.data.json.data;
    // senderIds narrows within team scope — ownerB is not on teamA, so no results
    expect(docs).toHaveLength(0);

    // Positive control: senderIds with own userId returns own docs
    const res2 = await trpcQuery(page, 'document.findDocumentsInternal', teamA.id, {
      senderIds: [ownerA.id],
      page: 1,
      perPage: 100,
    });

    expect(res2.ok()).toBeTruthy();
    const data2 = await res2.json();
    const docs2 = data2.result.data.json.data;
    expect(docs2).toHaveLength(1);
    expect(docs2[0].title).toBe('TeamA Doc by OwnerA');
  });

  test('senderIds with mix of valid and cross-team userIds should only return matching team docs', async ({
    page,
  }) => {
    const { team, owner } = await seedTeam();
    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
    const { user: outsider } = await seedUser();

    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Owner Doc' },
    });
    await seedDraftDocument(member, team.id, [], {
      createDocumentOptions: { title: 'Member Doc' },
    });

    // Find outsider's personal team
    const outsiderOrg = await prisma.organisation.findFirstOrThrow({
      where: { ownerUserId: outsider.id },
      include: { teams: true },
    });
    const outsiderTeamId = outsiderOrg.teams[0].id;

    await seedDraftDocument(outsider, outsiderTeamId, [], {
      createDocumentOptions: { title: 'Outsider Doc' },
    });

    await apiSignin({ page, email: owner.email });

    // Include outsider.id in senderIds — should be silently ignored (no results from them)
    const res = await trpcQuery(page, 'document.findDocumentsInternal', team.id, {
      senderIds: [member.id, outsider.id],
      page: 1,
      perPage: 100,
    });

    expect(res.ok()).toBeTruthy();
    const data = await res.json();
    const docs = data.result.data.json.data;
    const titles = docs.map((d: { title: string }) => d.title);
    // Only member doc should appear — outsider's docs are on a different team
    expect(titles).toContain('Member Doc');
    expect(titles).not.toContain('Owner Doc'); // owner not in senderIds
    expect(titles).not.toContain('Outsider Doc');
    expect(docs).toHaveLength(1);
  });
});

test.describe('Find Documents API - Adversarial: Cross-Team templateId', () => {
  test('should NOT return documents from another team when filtering by their templateId', async ({
    request,
  }) => {
    const { user: userA, team: teamA } = await seedUser();
    const { user: userB, team: teamB } = await seedUser();

    // Use a shared templateId integer (simulates a template that exists on teamB)
    const fakeTemplateId = 999888;

    // Create a doc in teamB with this templateId
    await seedDraftDocument(userB, teamB.id, [], {
      createDocumentOptions: {
        title: 'TeamB Doc from Template',
        templateId: fakeTemplateId,
      },
    });

    // Create a doc in teamA with a different templateId (positive control)
    const teamATemplateId = 999777;
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: {
        title: 'TeamA Doc from Template',
        templateId: teamATemplateId,
      },
    });
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'TeamA Regular Doc' },
    });

    const { token: tokenA } = await createApiToken({
      userId: userA.id,
      teamId: teamA.id,
      tokenName: 'tokenA',
      expiresIn: null,
    });

    // UserA tries to filter by teamB's templateId — should return empty, not teamB's docs
    const { json } = await findDocuments(request, tokenA, {
      templateId: String(fakeTemplateId),
    });
    expect(json!.data).toHaveLength(0);
    expect(json!.count).toBe(0);

    // Positive control: own templateId returns own docs
    const { json: ownTemplate } = await findDocuments(request, tokenA, {
      templateId: String(teamATemplateId),
    });
    expect(ownTemplate!.data).toHaveLength(1);
    expect(ownTemplate!.data[0].title).toBe('TeamA Doc from Template');
  });
});
