import { expect, test } from '@playwright/test';
import {
  DocumentStatus,
  DocumentVisibility,
  OrganisationMemberRole,
  TeamMemberRole,
} from '@prisma/client';

import { generateDatabaseId } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import {
  seedCompletedDocument,
  seedDocuments,
  seedDraftDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedTeam, seedTeamEmail, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../fixtures/authentication';
import { checkDocumentTabCount } from '../fixtures/documents';

test.describe.configure({
  mode: 'parallel',
});

test.describe('Find Documents UI - Personal Context', () => {
  test('should show all owned documents across statuses', async ({ page }) => {
    const { user: owner, team, organisation } = await seedUser();
    const { user: recipient } = await seedUser();

    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Personal Draft Doc' },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [recipient],
        type: DocumentStatus.PENDING,
        documentOptions: { title: 'Personal Pending Doc' },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [recipient],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Personal Completed Doc' },
      },
    ]);

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    await checkDocumentTabCount(page, 'All', 3);
    await checkDocumentTabCount(page, 'Draft', 1);
    await checkDocumentTabCount(page, 'Pending', 1);
    await checkDocumentTabCount(page, 'Completed', 1);
  });

  test('received documents from other teams should NOT appear in personal context', async ({
    page,
  }) => {
    // The UI always uses the team code path (findTeamDocumentsFilter) which filters by teamId.
    // Documents sent TO a user by another user's team live on the sender's teamId,
    // so they do NOT appear in the recipient's personal team context.
    const { user: owner, team: ownerTeam } = await seedUser();
    const { user: sender, team: senderTeam } = await seedUser();

    // Owner has their own doc (positive control — should appear)
    await seedDraftDocument(owner, ownerTeam.id, [], {
      createDocumentOptions: { title: 'Owner Own Draft' },
    });

    // Sender sends docs to owner (these live on senderTeam, NOT ownerTeam)
    await seedPendingDocument(sender, senderTeam.id, [owner], {
      createDocumentOptions: { title: 'Received Pending Doc' },
    });
    await seedCompletedDocument(sender, senderTeam.id, [owner], {
      createDocumentOptions: { title: 'Received Completed Doc' },
    });

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${ownerTeam.url}/documents`,
    });

    // Only the owner's own doc should appear (received docs are on sender's team)
    await checkDocumentTabCount(page, 'All', 1);
    await expect(page.getByRole('link', { name: 'Owner Own Draft' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Received Pending Doc', exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Received Completed Doc', exact: true }),
    ).not.toBeVisible();
  });

  test('should NOT show documents from other users', async ({ page }) => {
    const { user: userA, team: teamA } = await seedUser();
    const { user: userB, team: teamB } = await seedUser();

    await seedDraftDocument(userB, teamB.id, [], {
      createDocumentOptions: { title: 'UserB Secret Document' },
    });

    await apiSignin({
      page,
      email: userA.email,
      redirectPath: `/t/${teamA.url}/documents`,
    });

    await checkDocumentTabCount(page, 'All', 0);
    await expect(
      page.getByRole('link', { name: 'UserB Secret Document', exact: true }),
    ).not.toBeVisible();
  });

  test('personal context without team email should show 0 inbox', async ({ page }) => {
    // The UI uses the team code path. Without a teamEmail, INBOX returns null (empty).
    // Received docs from other teams don't appear in the user's personal team context.
    const { user: owner, team: ownerTeam } = await seedUser();
    const { user: sender, team: senderTeam } = await seedUser();

    // Sender sends a pending doc to owner (lives on sender's team, not owner's)
    await seedPendingDocument(sender, senderTeam.id, [owner], {
      createDocumentOptions: { title: 'Inbox Document for Owner' },
    });

    // Owner has their own doc (positive control)
    await seedDraftDocument(owner, ownerTeam.id, [], {
      createDocumentOptions: { title: 'Owner Draft Control' },
    });

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${ownerTeam.url}/documents`,
    });

    // Inbox should be 0 since there's no team email and received docs are on sender's team
    await checkDocumentTabCount(page, 'Inbox', 0);
    // Owner's own doc should still show in All
    await checkDocumentTabCount(page, 'All', 1);
    await expect(page.getByRole('link', { name: 'Owner Draft Control' })).toBeVisible();
  });

  test('should filter documents by search query', async ({ page }) => {
    const { user: owner, team } = await seedUser();

    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Quarterly Report 2024' },
    });
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Annual Budget Plan' },
    });

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    await page.getByPlaceholder('Search documents...').fill('Quarterly');
    await page.waitForURL(/query=Quarterly/);

    await checkDocumentTabCount(page, 'All', 1);
    await expect(page.getByRole('link', { name: 'Quarterly Report 2024' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Annual Budget Plan', exact: true }),
    ).not.toBeVisible();
  });

  test('should not show deleted documents', async ({ page }) => {
    const { user: owner, team } = await seedUser();

    const doc = await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Deleted Personal Doc' },
    });
    await prisma.envelope.update({
      where: { id: doc.id },
      data: { deletedAt: new Date() },
    });

    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Active Personal Doc' },
    });

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    await checkDocumentTabCount(page, 'All', 1);
    await expect(page.getByRole('link', { name: 'Active Personal Doc' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Deleted Personal Doc', exact: true }),
    ).not.toBeVisible();
  });

  test('should only show root-level documents when not in a folder', async ({ page }) => {
    const { user: owner, team } = await seedUser();

    const folder = await prisma.folder.create({
      data: {
        name: 'My Folder',
        teamId: team.id,
        userId: owner.id,
        type: 'DOCUMENT',
      },
    });

    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Root Level Doc', folderId: null },
    });
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Folder Level Doc', folderId: folder.id },
    });

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    await checkDocumentTabCount(page, 'All', 1);
    await expect(page.getByRole('link', { name: 'Root Level Doc' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Folder Level Doc', exact: true }),
    ).not.toBeVisible();
  });
});

test.describe('Find Documents UI - Team Context', () => {
  test('should show team documents to all team members', async ({ page }) => {
    const { team, owner } = await seedTeam();

    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });
    const { user: outsideUser, team: outsideTeam } = await seedUser();

    // Seed multiple team docs across statuses
    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [outsideUser],
        type: DocumentStatus.PENDING,
        documentOptions: { title: 'Team Pending Doc' },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Team Draft Doc' },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [outsideUser],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Team Completed Doc' },
      },
    ]);

    // Noise: outside user's docs should NOT appear
    await seedDraftDocument(outsideUser, outsideTeam.id, [], {
      createDocumentOptions: { title: 'Outside Noise Doc' },
    });

    // Both owner and member should see the 3 team documents
    for (const user of [owner, member]) {
      await apiSignin({
        page,
        email: user.email,
        redirectPath: `/t/${team.url}/documents`,
      });

      await checkDocumentTabCount(page, 'All', 3);
      await expect(page.getByRole('link', { name: 'Team Pending Doc' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Team Draft Doc' })).toBeVisible();
      await expect(page.getByRole('link', { name: 'Team Completed Doc' })).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Outside Noise Doc', exact: true }),
      ).not.toBeVisible();

      await apiSignout({ page });
    }
  });

  test('should NOT show documents from other teams', async ({ page }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    const memberA = await seedTeamMember({ teamId: teamA.id, role: TeamMemberRole.MEMBER });

    // Multiple docs per team to ensure isolation is thorough
    await seedDocuments([
      {
        sender: ownerA,
        teamId: teamA.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Team A Draft' },
      },
      {
        sender: ownerA,
        teamId: teamA.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Team A Completed' },
      },
      {
        sender: ownerB,
        teamId: teamB.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Team B Draft' },
      },
      {
        sender: ownerB,
        teamId: teamB.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Team B Completed' },
      },
    ]);

    await apiSignin({
      page,
      email: memberA.email,
      redirectPath: `/t/${teamA.url}/documents`,
    });

    await checkDocumentTabCount(page, 'All', 2);
    await expect(page.getByRole('link', { name: 'Team A Draft' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Team A Completed' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Team B Draft', exact: true })).not.toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Team B Completed', exact: true }),
    ).not.toBeVisible();
  });

  test('should NOT show personal documents in team context', async ({ page }) => {
    const { team, owner } = await seedTeam();

    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

    // Get member's personal team (seedUser creates an org with ownerUserId set)
    const memberOrg = await prisma.organisation.findFirstOrThrow({
      where: {
        ownerUserId: member.id,
      },
      include: {
        teams: true,
      },
    });

    const personalTeamId = memberOrg.teams[0].id;

    await seedDraftDocument(member, personalTeamId, [], {
      createDocumentOptions: { title: 'Personal Doc not in Team' },
    });

    await seedDraftDocument(member, team.id, [], {
      createDocumentOptions: { title: 'Team Doc by Member' },
    });

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    await expect(page.getByRole('link', { name: 'Team Doc by Member' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Personal Doc not in Team', exact: true }),
    ).not.toBeVisible();
  });

  test('should enforce ADMIN visibility correctly across roles', async ({ page }) => {
    const { user: owner, organisation, team } = await seedUser();

    const [adminUser, managerUser, memberUser] = await seedOrganisationMembers({
      organisationId: organisation.id,
      members: [
        { organisationRole: OrganisationMemberRole.ADMIN },
        { organisationRole: OrganisationMemberRole.MEMBER },
        { organisationRole: OrganisationMemberRole.MEMBER },
      ],
    });

    // Make managerUser actually a MANAGER in the team
    const managerTeamGroup = await prisma.teamGroup.findFirstOrThrow({
      where: { teamId: team.id, teamRole: TeamMemberRole.MANAGER },
      include: { organisationGroup: true },
    });
    const managerOrgMember = await prisma.organisationMember.findFirstOrThrow({
      where: { organisationId: organisation.id, userId: managerUser.id },
    });
    await prisma.organisationGroupMember.create({
      data: {
        id: generateDatabaseId('group_member'),
        groupId: managerTeamGroup.organisationGroupId,
        organisationMemberId: managerOrgMember.id,
      },
    });

    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Admin Only Doc',
          visibility: DocumentVisibility.ADMIN,
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Manager Plus Doc',
          visibility: DocumentVisibility.MANAGER_AND_ABOVE,
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Everyone Doc',
          visibility: DocumentVisibility.EVERYONE,
        },
      },
    ]);

    // Admin sees all 3
    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
    });
    await checkDocumentTabCount(page, 'Completed', 3);
    await apiSignout({ page });

    // Manager sees 2 (Everyone + Manager+)
    await apiSignin({
      page,
      email: managerUser.email,
      redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
    });
    await checkDocumentTabCount(page, 'Completed', 2);
    await expect(page.getByRole('link', { name: 'Everyone Doc' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Manager Plus Doc' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin Only Doc', exact: true })).not.toBeVisible();
    await apiSignout({ page });

    // Member sees 1 (Everyone only)
    await apiSignin({
      page,
      email: memberUser.email,
      redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
    });
    await checkDocumentTabCount(page, 'Completed', 1);
    await expect(page.getByRole('link', { name: 'Everyone Doc' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Manager Plus Doc', exact: true }),
    ).not.toBeVisible();
    await expect(page.getByRole('link', { name: 'Admin Only Doc', exact: true })).not.toBeVisible();
    await apiSignout({ page });
  });

  test('document owner sees their document regardless of visibility restriction', async ({
    page,
  }) => {
    const { team, owner } = await seedTeam();

    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

    // Member creates an ADMIN-visibility document (should see as owner)
    // Owner also creates an ADMIN doc (member should NOT see this one)
    // Owner creates an EVERYONE doc (positive control, member should see)
    await seedDocuments([
      {
        sender: member,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Member Owned Admin Doc',
          visibility: DocumentVisibility.ADMIN,
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Owner Admin Doc Hidden',
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

    await apiSignin({
      page,
      email: member.email,
      redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
    });

    // Member sees: their own ADMIN doc + EVERYONE doc, but NOT owner's ADMIN doc
    await checkDocumentTabCount(page, 'Completed', 2);
    await expect(page.getByRole('link', { name: 'Member Owned Admin Doc' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Everyone Doc Control' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Owner Admin Doc Hidden', exact: true }),
    ).not.toBeVisible();

    await apiSignout({ page });
  });

  test('recipient sees document regardless of visibility restriction', async ({ page }) => {
    const { team, owner } = await seedTeam();

    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

    // Owner creates ADMIN-only doc WITH member as recipient (member should see)
    // Owner creates ADMIN-only doc WITHOUT member as recipient (member should NOT see)
    // Owner creates EVERYONE doc (positive control)
    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [member],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Admin Doc Member Recipient',
          visibility: DocumentVisibility.ADMIN,
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Admin Doc No Member',
          visibility: DocumentVisibility.ADMIN,
        },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Everyone Doc Baseline',
          visibility: DocumentVisibility.EVERYONE,
        },
      },
    ]);

    await apiSignin({
      page,
      email: member.email,
      redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
    });

    // Member sees: ADMIN doc as recipient + EVERYONE doc, but NOT the ADMIN doc without them
    await checkDocumentTabCount(page, 'Completed', 2);
    await expect(page.getByRole('link', { name: 'Admin Doc Member Recipient' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Everyone Doc Baseline' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Admin Doc No Member', exact: true }),
    ).not.toBeVisible();

    await apiSignout({ page });
  });
});

test.describe('Find Documents UI - Team with Team Email', () => {
  test('should show documents sent TO team email', async ({ page }) => {
    const { team, owner } = await seedTeam();

    const teamEmail = `team-ui-email-${team.id}@test.documenso.com`;
    await seedTeamEmail({ email: teamEmail, teamId: team.id });

    const { user: externalUser, team: externalTeam } = await seedUser();
    const { user: externalUser2, team: externalTeam2 } = await seedUser();

    await seedDocuments([
      {
        sender: externalUser,
        teamId: externalTeam.id,
        recipients: [teamEmail],
        type: DocumentStatus.PENDING,
        documentOptions: { title: 'Email Received Pending' },
      },
      {
        sender: externalUser,
        teamId: externalTeam.id,
        recipients: [teamEmail],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Email Received Completed' },
      },
    ]);

    // Noise: docs between external users (should NOT appear in team context)
    await seedPendingDocument(externalUser, externalTeam.id, [externalUser2], {
      createDocumentOptions: { title: 'External Noise Pending' },
    });

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    // Should show received pending and completed docs but not noise
    // Note: Received-via-email docs render as <span> not <a> since they belong to external teams
    await checkDocumentTabCount(page, 'All', 2);
    await expect(page.getByRole('cell', { name: 'Email Received Pending' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'External Noise Pending' })).not.toBeVisible();

    await checkDocumentTabCount(page, 'Completed', 1);
    await expect(page.getByRole('cell', { name: 'Email Received Completed' })).toBeVisible();
  });

  test('should NOT show drafts sent TO team email', async ({ page }) => {
    const { team, owner } = await seedTeam();

    const teamEmail = `team-ui-draft-${team.id}@test.documenso.com`;
    await seedTeamEmail({ email: teamEmail, teamId: team.id });

    const { user: externalUser, team: externalTeam } = await seedUser();

    // Draft to team email (should NOT appear)
    await seedDraftDocument(externalUser, externalTeam.id, [teamEmail], {
      createDocumentOptions: { title: 'Draft To Team Email' },
    });

    // Pending to team email (positive control - SHOULD appear)
    await seedPendingDocument(externalUser, externalTeam.id, [teamEmail], {
      createDocumentOptions: { title: 'Pending To Team Email' },
    });

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    // Should see the pending doc but NOT the draft
    // Received-via-email docs render as <span> not <a>
    await checkDocumentTabCount(page, 'All', 1);
    await expect(page.getByRole('cell', { name: 'Pending To Team Email' })).toBeVisible();
    await expect(page.getByRole('cell', { name: 'Draft To Team Email' })).not.toBeVisible();
  });

  test('should show inbox count for team email recipients', async ({ page }) => {
    const { team, owner } = await seedTeam();

    const teamEmail = `team-ui-inbox-${team.id}@test.documenso.com`;
    await seedTeamEmail({ email: teamEmail, teamId: team.id });

    const { user: sender1, team: sender1Team } = await seedUser();
    const { user: sender2, team: sender2Team } = await seedUser();

    await seedDocuments([
      {
        sender: sender1,
        teamId: sender1Team.id,
        recipients: [teamEmail],
        type: DocumentStatus.PENDING,
        documentOptions: { title: 'Inbox Doc 1' },
      },
      {
        sender: sender2,
        teamId: sender2Team.id,
        recipients: [teamEmail],
        type: DocumentStatus.PENDING,
        documentOptions: { title: 'Inbox Doc 2' },
      },
    ]);

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    await checkDocumentTabCount(page, 'Inbox', 2);
  });

  test('team without team email should show 0 inbox', async ({ page }) => {
    const { team, owner } = await seedTeam();

    // No team email set up
    const { user: outsideUser, team: outsideTeam } = await seedUser();

    await seedPendingDocument(owner, team.id, [outsideUser], {
      createDocumentOptions: { title: 'Pending Without Inbox' },
    });

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    await checkDocumentTabCount(page, 'Inbox', 0);
    // But pending should still show
    await checkDocumentTabCount(page, 'Pending', 1);
  });

  test('documents sent BY team email user should appear in team context', async ({ page }) => {
    const { team, owner } = await seedTeam({ createTeamMembers: 1 });

    const teamEmailHolder = owner;

    await seedTeamEmail({
      email: teamEmailHolder.email,
      teamId: team.id,
    });

    const { user: externalUser, team: externalTeam } = await seedUser();

    // Team email holder sends multiple documents
    await seedDocuments([
      {
        sender: teamEmailHolder,
        teamId: team.id,
        recipients: [externalUser],
        type: DocumentStatus.PENDING,
        documentOptions: { title: 'Sent by Holder Pending' },
      },
      {
        sender: teamEmailHolder,
        teamId: team.id,
        recipients: [externalUser],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Sent by Holder Completed' },
      },
    ]);

    // Noise: external user's own docs (should NOT appear in team context)
    await seedDraftDocument(externalUser, externalTeam.id, [], {
      createDocumentOptions: { title: 'External Own Draft' },
    });

    const member = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

    await apiSignin({
      page,
      email: member.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    await checkDocumentTabCount(page, 'All', 2);
    await expect(page.getByRole('link', { name: 'Sent by Holder Pending' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Sent by Holder Completed' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'External Own Draft', exact: true }),
    ).not.toBeVisible();
  });
});

test.describe('Find Documents UI - Data Isolation & No Leaking', () => {
  test('user cannot see another user personal documents via any status tab', async ({ page }) => {
    const { user: userA, team: teamA } = await seedUser();
    const { user: userB, team: teamB } = await seedUser();

    // UserA has their own docs (positive control to verify the page works)
    await seedDraftDocument(userA, teamA.id, [], {
      createDocumentOptions: { title: 'A Own Draft' },
    });
    await seedPendingDocument(userA, teamA.id, [userA], {
      createDocumentOptions: { title: 'A Own Pending' },
    });
    await seedCompletedDocument(userA, teamA.id, [userA], {
      createDocumentOptions: { title: 'A Own Completed' },
    });

    // UserB has their own docs (noise — should NOT appear for userA)
    await seedDocuments([
      {
        sender: userB,
        teamId: teamB.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'B Draft Private' },
      },
      {
        sender: userB,
        teamId: teamB.id,
        recipients: [userB],
        type: DocumentStatus.PENDING,
        documentOptions: { title: 'B Pending Private' },
      },
      {
        sender: userB,
        teamId: teamB.id,
        recipients: [userB],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'B Completed Private' },
      },
    ]);

    await apiSignin({
      page,
      email: userA.email,
      redirectPath: `/t/${teamA.url}/documents`,
    });

    // UserA should see only their own docs
    await checkDocumentTabCount(page, 'All', 3);
    await checkDocumentTabCount(page, 'Draft', 1);
    await checkDocumentTabCount(page, 'Completed', 1);

    // Verify no B docs leaked
    await page.getByRole('tab', { name: 'All' }).click();
    await expect(page.getByRole('link', { name: 'A Own Draft' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'B Draft Private', exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('link', { name: 'B Pending Private', exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('link', { name: 'B Completed Private', exact: true }),
    ).not.toBeVisible();
  });

  test('team member cannot see documents from another team via search', async ({ page }) => {
    const { team: teamA, owner: ownerA } = await seedTeam();
    const { team: teamB, owner: ownerB } = await seedTeam();

    const memberA = await seedTeamMember({ teamId: teamA.id, role: TeamMemberRole.MEMBER });

    // TeamA has a doc with "Super Secret" in the title (positive control)
    await seedDocuments([
      {
        sender: ownerA,
        teamId: teamA.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Super Secret TeamA Document',
          visibility: DocumentVisibility.EVERYONE,
        },
      },
    ]);

    // TeamB has a doc with "Super Secret" in the title (should NOT appear)
    await seedDocuments([
      {
        sender: ownerB,
        teamId: teamB.id,
        recipients: [],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Super Secret TeamB Document',
          visibility: DocumentVisibility.EVERYONE,
        },
      },
    ]);

    await apiSignin({
      page,
      email: memberA.email,
      redirectPath: `/t/${teamA.url}/documents`,
    });

    await page.getByPlaceholder('Search documents...').fill('Super Secret');
    await page.waitForURL(/query=Super/);

    // Should find the TeamA doc but NOT the TeamB doc
    await checkDocumentTabCount(page, 'All', 1);
    await expect(page.getByRole('link', { name: 'Super Secret TeamA Document' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Super Secret TeamB Document', exact: true }),
    ).not.toBeVisible();
  });

  test('search by recipient name should respect team visibility', async ({ page }) => {
    const { user: owner, organisation, team } = await seedUser();

    const [adminUser, memberUser] = await seedOrganisationMembers({
      organisationId: organisation.id,
      members: [
        { organisationRole: OrganisationMemberRole.ADMIN },
        { organisationRole: OrganisationMemberRole.MEMBER },
      ],
    });

    const { user: uniqueRecipient } = await seedUser({ name: 'Very Unique Recipient Name' });

    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [uniqueRecipient],
        type: DocumentStatus.COMPLETED,
        documentOptions: {
          title: 'Admin Doc with Unique Recipient',
          visibility: DocumentVisibility.ADMIN,
        },
      },
    ]);

    // Admin can find by recipient name
    await apiSignin({
      page,
      email: adminUser.email,
      redirectPath: `/t/${team.url}/documents`,
    });
    await page.getByPlaceholder('Search documents...').fill('Very Unique Recipient');
    await page.waitForURL(/query=Very/);
    await checkDocumentTabCount(page, 'All', 1);
    await apiSignout({ page });

    // Member cannot find by recipient name (visibility blocks it)
    await apiSignin({
      page,
      email: memberUser.email,
      redirectPath: `/t/${team.url}/documents`,
    });
    await page.getByPlaceholder('Search documents...').fill('Very Unique Recipient');
    await page.waitForURL(/query=Very/);
    await checkDocumentTabCount(page, 'All', 0);
    await apiSignout({ page });
  });

  test('outside user does NOT see cross-team received docs in their personal context', async ({
    page,
  }) => {
    // The UI always uses the team code path (findTeamDocumentsFilter) which filters by teamId.
    // Documents from team.id will NOT appear in outsideTeam's context.
    const { team, owner } = await seedTeam();
    const { user: outsideUser, team: outsideTeam } = await seedUser();
    const { user: otherUser } = await seedUser();

    // Team doc sent to outside user (lives on team.id, NOT outsideTeam.id)
    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [outsideUser],
        type: DocumentStatus.PENDING,
        documentOptions: {
          title: 'Team Doc For Outside User',
          visibility: DocumentVisibility.ADMIN,
        },
      },
    ]);

    // Team doc NOT sent to outside user (noise)
    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [otherUser],
        type: DocumentStatus.PENDING,
        documentOptions: {
          title: 'Team Doc For Other User Only',
          visibility: DocumentVisibility.ADMIN,
        },
      },
    ]);

    // Outside user has their own draft (positive control)
    await seedDraftDocument(outsideUser, outsideTeam.id, [], {
      createDocumentOptions: { title: 'Outside Own Draft' },
    });

    await apiSignin({
      page,
      email: outsideUser.email,
      redirectPath: `/t/${outsideTeam.url}/documents`,
    });

    // Only the outside user's own draft should appear (cross-team docs are not visible)
    await checkDocumentTabCount(page, 'Inbox', 0); // No team email → 0
    await checkDocumentTabCount(page, 'All', 1); // Check All tab last so we can verify visible links
    await expect(page.getByRole('link', { name: 'Outside Own Draft' })).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Team Doc For Outside User', exact: true }),
    ).not.toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Team Doc For Other User Only', exact: true }),
    ).not.toBeVisible();
  });
});

test.describe('Find Documents UI - Tab Counts Consistency', () => {
  test('personal context tab counts should be accurate', async ({ page }) => {
    // In the UI, personal team uses findTeamDocumentsFilter (team code path).
    // Only docs with teamId = ownerTeam.id are shown.
    // Docs sent TO owner by other users live on the sender's team and won't appear.
    // Without a teamEmail, INBOX returns 0.
    const { user: owner, team: ownerTeam } = await seedUser();
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: recipient } = await seedUser();

    // Owner's own documents (all on ownerTeam)
    await seedDraftDocument(owner, ownerTeam.id, [], {
      createDocumentOptions: { title: 'My Draft 1' },
    });
    await seedDraftDocument(owner, ownerTeam.id, [], {
      createDocumentOptions: { title: 'My Draft 2' },
    });
    await seedPendingDocument(owner, ownerTeam.id, [recipient], {
      createDocumentOptions: { title: 'My Pending 1' },
    });
    await seedCompletedDocument(owner, ownerTeam.id, [recipient], {
      createDocumentOptions: { title: 'My Completed 1' },
    });

    // Documents sent TO owner (these live on senderTeam, NOT ownerTeam — won't appear)
    await seedPendingDocument(sender, senderTeam.id, [owner], {
      createDocumentOptions: { title: 'Received Pending 1' },
    });
    await seedCompletedDocument(sender, senderTeam.id, [owner], {
      createDocumentOptions: { title: 'Received Completed 1' },
    });

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${ownerTeam.url}/documents`,
    });

    // Only owner's own docs appear (received docs are on sender's team)
    await checkDocumentTabCount(page, 'Draft', 2);
    await checkDocumentTabCount(page, 'Pending', 1);
    await checkDocumentTabCount(page, 'Inbox', 0); // No team email → inbox returns null → 0
    await checkDocumentTabCount(page, 'Completed', 1); // Only owned completed (received is on sender's team)
    await checkDocumentTabCount(page, 'All', 4); // 2 drafts + 1 pending + 1 completed
  });

  test('team context tab counts should be accurate with mixed documents', async ({ page }) => {
    const { team, owner } = await seedTeam({ createTeamMembers: 2 });

    const member1 = (
      await prisma.organisation.findFirstOrThrow({
        where: { teams: { some: { id: team.id } } },
        include: { members: { include: { user: true } } },
      })
    ).members[1].user;

    const { user: outsideUser, team: outsideTeam } = await seedUser();

    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Team Draft 1' },
      },
      {
        sender: member1,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Team Draft 2' },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [outsideUser],
        type: DocumentStatus.PENDING,
        documentOptions: { title: 'Team Pending 1' },
      },
      {
        sender: owner,
        teamId: team.id,
        recipients: [outsideUser],
        type: DocumentStatus.COMPLETED,
        documentOptions: { title: 'Team Completed 1' },
      },
    ]);

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    await checkDocumentTabCount(page, 'Draft', 2);
    await checkDocumentTabCount(page, 'Pending', 1);
    await checkDocumentTabCount(page, 'Completed', 1);
    await checkDocumentTabCount(page, 'All', 4);
  });

  test('team with team email tab counts should include received documents', async ({ page }) => {
    const { team, owner } = await seedTeam();

    const teamEmail = `team-count-${team.id}@test.documenso.com`;
    await seedTeamEmail({ email: teamEmail, teamId: team.id });

    const { user: external1, team: ext1Team } = await seedUser();
    const { user: external2, team: ext2Team } = await seedUser();

    // Team's own documents
    await seedDraftDocument(owner, team.id, [], {
      createDocumentOptions: { title: 'Own Draft' },
    });
    await seedPendingDocument(owner, team.id, [external1], {
      createDocumentOptions: { title: 'Own Pending' },
    });

    // Documents sent TO team email
    await seedPendingDocument(external1, ext1Team.id, [teamEmail], {
      createDocumentOptions: { title: 'Received Pending via Email' },
    });
    await seedCompletedDocument(external2, ext2Team.id, [teamEmail], {
      createDocumentOptions: { title: 'Received Completed via Email' },
    });

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    await checkDocumentTabCount(page, 'Draft', 1);
    await checkDocumentTabCount(page, 'Inbox', 1); // One pending doc received by team email (NOT_SIGNED)
    await checkDocumentTabCount(page, 'Pending', 1); // Own pending
    await checkDocumentTabCount(page, 'Completed', 1); // Received completed via email
    await checkDocumentTabCount(page, 'All', 4); // All of the above
  });
});

test.describe('Find Documents UI - Sender Filter', () => {
  test('sender filter should narrow results correctly', async ({ page }) => {
    const { team, owner } = await seedTeam({ createTeamMembers: 2 });

    const org = await prisma.organisation.findFirstOrThrow({
      where: { teams: { some: { id: team.id } } },
      include: { members: { include: { user: true }, orderBy: { id: 'asc' } } },
    });

    const member1 = org.members[1].user;
    const member2 = org.members[2].user;

    const { user: outsideUser } = await seedUser();

    await seedDocuments([
      {
        sender: owner,
        teamId: team.id,
        recipients: [outsideUser],
        type: DocumentStatus.PENDING,
        documentOptions: { title: 'Owner Sent Doc' },
      },
      {
        sender: member1,
        teamId: team.id,
        recipients: [outsideUser],
        type: DocumentStatus.PENDING,
        documentOptions: { title: 'Member1 Sent Doc' },
      },
      {
        sender: member2,
        teamId: team.id,
        recipients: [],
        type: DocumentStatus.DRAFT,
        documentOptions: { title: 'Member2 Draft Doc' },
      },
    ]);

    await apiSignin({
      page,
      email: owner.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    // Unfiltered: 3 docs total
    await checkDocumentTabCount(page, 'All', 3);

    // Filter by member1
    await page.locator('button').filter({ hasText: 'Sender: All' }).click();
    await page.getByRole('option', { name: member1.name ?? '' }).click();
    await page.waitForURL(/senderIds/);

    // Should only show member1's doc
    await checkDocumentTabCount(page, 'All', 1);
    await expect(page.getByRole('link', { name: 'Member1 Sent Doc' })).toBeVisible();
  });
});
