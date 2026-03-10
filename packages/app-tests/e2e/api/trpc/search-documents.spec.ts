import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { OrganisationMemberRole, TeamMemberRole } from '@prisma/client';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { DocumentStatus } from '@documenso/prisma/client';
import {
  seedCompletedDocument,
  seedDocuments,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({
  mode: 'parallel',
});

const trpcDocumentSearch = async (page: Page, query: string) => {
  const inputParam = encodeURIComponent(JSON.stringify({ json: { query } }));
  const url = `${WEBAPP_BASE_URL}/api/trpc/document.search?input=${inputParam}`;

  const res = await page.context().request.get(url);

  return {
    res,
    data: res.ok()
      ? // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        ((await res.json()).result.data.json as Array<{
          title: string;
          path: string;
          value: string;
        }>)
      : null,
  };
};

// ─── Visibility ──────────────────────────────────────────────────────────────

test.describe('Document Search - Visibility', () => {
  test('should respect team document visibility per role', async ({ page }) => {
    const { user: owner, organisation, team } = await seedUser();

    const [adminUser, managerUser, memberUser] = await seedOrganisationMembers({
      organisationId: organisation.id,
      members: [
        { organisationRole: OrganisationMemberRole.ADMIN },
        { organisationRole: OrganisationMemberRole.MEMBER },
        { organisationRole: OrganisationMemberRole.MEMBER },
      ],
    });

    const managerTeamGroup = await prisma.teamGroup.findFirstOrThrow({
      where: { teamId: team.id, teamRole: TeamMemberRole.MANAGER },
      include: { organisationGroup: true },
    });

    const managerOrganisationMember = await prisma.organisationMember.findFirstOrThrow({
      where: { organisationId: organisation.id, userId: managerUser.id },
    });

    await prisma.organisationGroupMember.create({
      data: {
        id: generateDatabaseId('group_member'),
        groupId: managerTeamGroup.organisationGroupId,
        organisationMemberId: managerOrganisationMember.id,
      },
    });

    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          visibility: 'EVERYONE',
          title: 'Searchable Document for Everyone',
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          visibility: 'MANAGER_AND_ABOVE',
          title: 'Searchable Document for Managers',
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          visibility: 'ADMIN',
          title: 'Searchable Document for Admins',
        },
      },
    ]);

    const testCases = [
      { user: adminUser, visibleDocs: 3 },
      { user: managerUser, visibleDocs: 2 },
      { user: memberUser, visibleDocs: 1 },
    ];

    for (const { user, visibleDocs } of testCases) {
      await apiSignin({ page, email: user.email });

      const { data } = await trpcDocumentSearch(page, 'Searchable Document');

      expect(data).not.toBeNull();
      expect(data).toHaveLength(visibleDocs);

      await apiSignout({ page });
    }
  });

  test('should respect visibility when searching by recipient email', async ({ page }) => {
    const { team, owner } = await seedTeam();
    const adminUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
    const memberUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

    const { user: uniqueRecipient } = await seedUser();

    await seedDocuments([
      {
        sender: owner,
        recipients: [uniqueRecipient],
        type: DocumentStatus.COMPLETED,
        teamId: team.id,
        documentOptions: {
          visibility: 'ADMIN',
          title: 'Admin Document for Unique Recipient',
        },
      },
    ]);

    // Admin can find the ADMIN-visibility document by recipient email.
    await apiSignin({ page, email: adminUser.email });

    const { data: adminData } = await trpcDocumentSearch(page, uniqueRecipient.email);

    expect(adminData).not.toBeNull();
    expect(adminData).toHaveLength(1);
    expect(adminData![0].title).toBe('Admin Document for Unique Recipient');

    await apiSignout({ page });

    // Member cannot find the ADMIN-visibility document by recipient email.
    await apiSignin({ page, email: memberUser.email });

    const { data: memberData } = await trpcDocumentSearch(page, uniqueRecipient.email);

    expect(memberData).not.toBeNull();
    expect(memberData).toHaveLength(0);

    await apiSignout({ page });
  });
});

// ─── Cross-Team Isolation ────────────────────────────────────────────────────

test.describe('Document Search - Cross-Team Isolation', () => {
  test('should not reveal documents from other teams', async ({ page }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    const memberA = await seedTeamMember({ teamId: teamA.id, role: TeamMemberRole.MEMBER });

    await seedDocuments([
      {
        sender: ownerA,
        teamId: teamA.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          visibility: 'EVERYONE',
          title: 'Unique Team A Document',
        },
      },
      {
        sender: ownerB,
        teamId: teamB.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          visibility: 'EVERYONE',
          title: 'Unique Team B Document',
        },
      },
    ]);

    await apiSignin({ page, email: memberA.email });

    const { data } = await trpcDocumentSearch(page, 'Unique');

    expect(data).not.toBeNull();
    const titles = data!.map((d) => d.title);

    expect(titles).toContain('Unique Team A Document');
    expect(titles).not.toContain('Unique Team B Document');

    await apiSignout({ page });
  });

  test('should not cross team boundaries when searching SQL wildcard "%"', async ({ page }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    await seedDocuments([
      {
        sender: ownerA,
        teamId: teamA.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Wildcard Doc A' },
      },
    ]);

    await seedDocuments([
      {
        sender: ownerB,
        teamId: teamB.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Wildcard Doc B' },
      },
    ]);

    await apiSignin({ page, email: ownerA.email });

    const { data } = await trpcDocumentSearch(page, '%');

    expect(data).not.toBeNull();
    expect(data!.map((d) => d.title)).not.toContain('Wildcard Doc B');

    await apiSignout({ page });
  });

  test('should not cross team boundaries when searching SQL wildcard "_"', async ({ page }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    await seedDocuments([
      {
        sender: ownerA,
        teamId: teamA.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Underscore A' },
      },
    ]);

    await seedDocuments([
      {
        sender: ownerB,
        teamId: teamB.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Underscore B' },
      },
    ]);

    await apiSignin({ page, email: ownerA.email });

    const { data } = await trpcDocumentSearch(page, '_');

    expect(data).not.toBeNull();
    expect(data!.map((d) => d.title)).not.toContain('Underscore B');

    await apiSignout({ page });
  });
});

// ─── Recipient Search ────────────────────────────────────────────────────────

test.describe('Document Search - Recipient', () => {
  test('should find documents where user is a recipient', async ({ page }) => {
    const { team: senderTeam, owner: sender } = await seedTeam();
    const { user: recipient } = await seedUser();

    await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Recipient Search Test Doc' },
    });

    await apiSignin({ page, email: recipient.email });

    const { data } = await trpcDocumentSearch(page, 'Recipient Search Test');

    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);

    const result = data!.find((d) => d.title === 'Recipient Search Test Doc');
    expect(result).toBeDefined();
    expect(result!.path).toMatch(/^\/sign\/.+/);

    await apiSignout({ page });
  });
});

// ─── Token Masking ───────────────────────────────────────────────────────────

test.describe('Document Search - Token Masking', () => {
  test('should not expose signing token in value field', async ({ page }) => {
    const { team, owner } = await seedTeam();
    const { user: recipient } = await seedUser();

    const doc = await seedPendingDocument(owner, team.id, [recipient], {
      createDocumentOptions: { title: 'Token Leakage Test Document' },
    });

    const recipientRecord = await prisma.recipient.findFirstOrThrow({
      where: { envelopeId: doc.id, email: recipient.email },
      select: { token: true },
    });

    const signingToken = recipientRecord.token;

    // Owner should see the doc but not any signing token.
    await apiSignin({ page, email: owner.email });

    const { data } = await trpcDocumentSearch(page, 'Token Leakage Test');

    expect(data).not.toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);

    const result = data!.find((d) => d.title === 'Token Leakage Test Document');
    expect(result).toBeDefined();
    expect(result!.value).not.toContain(signingToken);
    expect(result!.path).not.toContain('/sign/');

    await apiSignout({ page });

    // Recipient should get their own /sign/ path but token still hidden from value.
    await apiSignin({ page, email: recipient.email });

    const { data: recipientData } = await trpcDocumentSearch(page, 'Token Leakage Test');

    expect(recipientData).not.toBeNull();
    expect(recipientData!.length).toBeGreaterThanOrEqual(1);

    const recipientResult = recipientData!.find((d) => d.title === 'Token Leakage Test Document');
    expect(recipientResult).toBeDefined();
    expect(recipientResult!.path).toBe(`/sign/${signingToken}`);
    expect(recipientResult!.value).not.toContain(signingToken);

    await apiSignout({ page });
  });

  test('should not expose other recipients signing tokens to the owner', async ({ page }) => {
    const { team, owner } = await seedTeam();
    const { user: recipientA } = await seedUser();
    const { user: recipientB } = await seedUser();

    const doc = await seedPendingDocument(owner, team.id, [recipientA, recipientB], {
      createDocumentOptions: { title: 'Multi Recipient Token Test' },
    });

    const recipients = await prisma.recipient.findMany({
      where: { envelopeId: doc.id },
      select: { token: true, email: true },
    });

    await apiSignin({ page, email: owner.email });

    const { data } = await trpcDocumentSearch(page, 'Multi Recipient Token');

    expect(data).not.toBeNull();
    const result = data!.find((d) => d.title === 'Multi Recipient Token Test');
    expect(result).toBeDefined();

    for (const r of recipients) {
      expect(result!.value).not.toContain(r.token);
      expect(result!.path).not.toContain(r.token);
    }

    await apiSignout({ page });
  });
});

// ─── Filtering ───────────────────────────────────────────────────────────────

test.describe('Document Search - Filtering', () => {
  test('should exclude soft-deleted documents', async ({ page }) => {
    const { team, owner } = await seedTeam();

    await seedCompletedDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Active Deletable Document' },
    });

    const deletedDoc = await seedCompletedDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Deleted Deletable Document' },
    });

    await prisma.envelope.update({
      where: { id: deletedDoc.id },
      data: { deletedAt: new Date() },
    });

    await apiSignin({ page, email: owner.email });

    const { data } = await trpcDocumentSearch(page, 'Deletable Document');

    expect(data).not.toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].title).toBe('Active Deletable Document');

    await apiSignout({ page });
  });

  test('should find documents by externalId', async ({ page }) => {
    const { team, owner } = await seedTeam();

    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: {
          title: 'ExternalId Test Doc',
          externalId: 'ext-unique-abc-123',
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: {
          title: 'Other Test Doc',
          externalId: 'ext-other-xyz',
        },
      },
    ]);

    await apiSignin({ page, email: owner.email });

    const { data } = await trpcDocumentSearch(page, 'ext-unique-abc');

    expect(data).not.toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].title).toBe('ExternalId Test Doc');

    await apiSignout({ page });
  });
});

// ─── Authentication ──────────────────────────────────────────────────────────

test.describe('Document Search - Authentication', () => {
  test('should reject unauthenticated requests', async ({ page }) => {
    const { res } = await trpcDocumentSearch(page, 'anything');

    expect(res.ok()).toBeFalsy();
    expect(res.status()).toBe(401);
  });
});
