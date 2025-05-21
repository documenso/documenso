import { expect, test } from '@playwright/test';
import { DocumentStatus, DocumentVisibility, TeamMemberRole } from '@prisma/client';

import {
  seedBlankDocument,
  seedDocuments,
  seedTeamDocuments,
} from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamEmail, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin, apiSignout } from '../fixtures/authentication';
import { checkDocumentTabCount } from '../fixtures/documents';

test('[TEAMS]: check team documents count', async ({ page }) => {
  const { team, teamMember2 } = await seedTeamDocuments();

  // Run the test twice, once with the team owner and once with a team member to ensure the counts are the same.
  for (const user of [team.owner, teamMember2]) {
    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    // Check document counts.
    await checkDocumentTabCount(page, 'Inbox', 0);
    await checkDocumentTabCount(page, 'Pending', 2);
    await checkDocumentTabCount(page, 'Completed', 1);
    await checkDocumentTabCount(page, 'Draft', 2);
    await checkDocumentTabCount(page, 'All', 5);

    // Apply filter.
    await page.locator('button').filter({ hasText: 'Sender: All' }).click();
    await page.getByRole('option', { name: teamMember2.name ?? '' }).click();
    await page.waitForURL(/senderIds/);

    // Check counts after filtering.
    await checkDocumentTabCount(page, 'Inbox', 0);
    await checkDocumentTabCount(page, 'Pending', 2);
    await checkDocumentTabCount(page, 'Completed', 0);
    await checkDocumentTabCount(page, 'Draft', 1);
    await checkDocumentTabCount(page, 'All', 3);

    await apiSignout({ page });
  }
});

test('[TEAMS]: check team documents count with internal team email', async ({ page }) => {
  const { team, teamMember2, teamMember4 } = await seedTeamDocuments();
  const { team: team2, teamMember2: team2Member2 } = await seedTeamDocuments();

  const teamEmailMember = teamMember4;

  await seedTeamEmail({
    email: teamEmailMember.email,
    teamId: team.id,
  });

  const testUser1 = await seedUser();

  await seedDocuments([
    // Documents sent from the team email account.
    {
      sender: teamEmailMember,
      recipients: [testUser1],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
      },
    },
    {
      sender: teamEmailMember,
      recipients: [testUser1],
      type: DocumentStatus.PENDING,
      documentOptions: {
        teamId: team.id,
      },
    },
    {
      sender: teamMember4,
      recipients: [testUser1],
      type: DocumentStatus.DRAFT,
    },
    // Documents sent to the team email account.
    {
      sender: testUser1,
      recipients: [teamEmailMember],
      type: DocumentStatus.COMPLETED,
    },
    {
      sender: testUser1,
      recipients: [teamEmailMember],
      type: DocumentStatus.PENDING,
    },
    {
      sender: testUser1,
      recipients: [teamEmailMember],
      type: DocumentStatus.DRAFT,
    },
    // Document sent to the team email account from another team.
    {
      sender: team2Member2,
      recipients: [teamEmailMember],
      type: DocumentStatus.PENDING,
      documentOptions: {
        teamId: team2.id,
      },
    },
  ]);

  // Run the test twice, one with the team owner and once with the team member email to ensure the counts are the same.
  for (const user of [team.owner, teamEmailMember]) {
    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents?perPage=20`,
    });

    // Check document counts.
    await checkDocumentTabCount(page, 'Inbox', 2);
    await checkDocumentTabCount(page, 'Pending', 3);
    await checkDocumentTabCount(page, 'Completed', 3);
    await checkDocumentTabCount(page, 'Draft', 3);
    await checkDocumentTabCount(page, 'All', 11);

    // Apply filter.
    await page.locator('button').filter({ hasText: 'Sender: All' }).click();
    await page.getByRole('option', { name: teamMember2.name ?? '' }).click();
    await page.waitForURL(/senderIds/);

    // Check counts after filtering.
    await checkDocumentTabCount(page, 'Inbox', 0);
    await checkDocumentTabCount(page, 'Pending', 2);
    await checkDocumentTabCount(page, 'Completed', 0);
    await checkDocumentTabCount(page, 'Draft', 1);
    await checkDocumentTabCount(page, 'All', 3);

    await apiSignout({ page });
  }
});

test('[TEAMS]: check team documents count with external team email', async ({ page }) => {
  const { team, teamMember2 } = await seedTeamDocuments();
  const { team: team2, teamMember2: team2Member2 } = await seedTeamDocuments();

  const teamEmail = `external-team-email-${team.id}@test.documenso.com`;

  await seedTeamEmail({
    email: teamEmail,
    teamId: team.id,
  });

  const testUser1 = await seedUser();

  await seedDocuments([
    // Documents sent to the team email account.
    {
      sender: testUser1,
      recipients: [teamEmail],
      type: DocumentStatus.COMPLETED,
    },
    {
      sender: testUser1,
      recipients: [teamEmail],
      type: DocumentStatus.PENDING,
    },
    {
      sender: testUser1,
      recipients: [teamEmail],
      type: DocumentStatus.DRAFT,
    },
    // Document sent to the team email account from another team.
    {
      sender: team2Member2,
      recipients: [teamEmail],
      type: DocumentStatus.PENDING,
      documentOptions: {
        teamId: team2.id,
      },
    },
    // Document sent to the team email account from an individual user.
    {
      sender: testUser1,
      recipients: [teamEmail],
      type: DocumentStatus.PENDING,
      documentOptions: {
        teamId: team2.id,
      },
    },
    {
      sender: testUser1,
      recipients: [teamEmail],
      type: DocumentStatus.DRAFT,
      documentOptions: {
        teamId: team2.id,
      },
    },
  ]);

  await apiSignin({
    page,
    email: teamMember2.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  // Check document counts.
  await checkDocumentTabCount(page, 'Inbox', 3);
  await checkDocumentTabCount(page, 'Pending', 2);
  await checkDocumentTabCount(page, 'Completed', 2);
  await checkDocumentTabCount(page, 'Draft', 2);
  await checkDocumentTabCount(page, 'All', 9);

  // Apply filter.
  await page.locator('button').filter({ hasText: 'Sender: All' }).click();
  await page.getByRole('option', { name: teamMember2.name ?? '' }).click();
  await page.waitForURL(/senderIds/);

  // Check counts after filtering.
  await checkDocumentTabCount(page, 'Inbox', 0);
  await checkDocumentTabCount(page, 'Pending', 2);
  await checkDocumentTabCount(page, 'Completed', 0);
  await checkDocumentTabCount(page, 'Draft', 1);
  await checkDocumentTabCount(page, 'All', 3);
});

test('[TEAMS]: resend pending team document', async ({ page }) => {
  const { team, teamMember2: currentUser } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: currentUser.email,
    redirectPath: `/t/${team.url}/documents?status=PENDING`,
  });

  await page.getByRole('row').getByRole('button').nth(1).click();
  await page.getByRole('menuitem', { name: 'Resend' }).waitFor({ state: 'visible' });
  await page.getByRole('menuitem', { name: 'Resend' }).click({ force: true });

  await page.getByRole('checkbox').first().check({ force: true });
  await page.getByRole('button', { name: 'Send reminder' }).waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Send reminder' }).click({ force: true });

  await expect(page.locator('span[role="status"]')).toContainText('Document re-sent');
});

test('[TEAMS]: delete draft team document', async ({ page }) => {
  const { team, teamMember2: teamEmailMember, teamMember3 } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: teamMember3.email,
    redirectPath: `/t/${team.url}/documents?status=DRAFT`,
  });

  await page.getByRole('row').getByRole('button').nth(1).click();

  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByRole('button', { name: 'Delete' }).click();

  await checkDocumentTabCount(page, 'Draft', 1);

  // Should be hidden for all team members.
  await apiSignout({ page });

  // Run the test twice, one with the team owner and once with the team member email to ensure the counts are the same.
  for (const user of [team.owner, teamEmailMember]) {
    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    // Check document counts.
    await checkDocumentTabCount(page, 'Inbox', 0);
    await checkDocumentTabCount(page, 'Pending', 2);
    await checkDocumentTabCount(page, 'Completed', 1);
    await checkDocumentTabCount(page, 'Draft', 1);
    await checkDocumentTabCount(page, 'All', 4);

    await apiSignout({ page });
  }
});

test('[TEAMS]: delete pending team document', async ({ page }) => {
  const { team, teamMember2: teamEmailMember, teamMember3 } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: teamMember3.email,
    redirectPath: `/t/${team.url}/documents?status=PENDING`,
  });

  await page.getByRole('row').getByRole('button').nth(1).click();

  await page.getByRole('menuitem', { name: 'Delete' }).click({ force: true });
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click({ force: true });

  await checkDocumentTabCount(page, 'Pending', 1);

  // Should be hidden for all team members.
  await apiSignout({ page });

  // Run the test twice, one with the team owner and once with the team member email to ensure the counts are the same.
  for (const user of [team.owner, teamEmailMember]) {
    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    // Check document counts.
    await checkDocumentTabCount(page, 'Inbox', 0);
    await checkDocumentTabCount(page, 'Pending', 1);
    await checkDocumentTabCount(page, 'Completed', 1);
    await checkDocumentTabCount(page, 'Draft', 2);
    await checkDocumentTabCount(page, 'All', 4);

    await apiSignout({ page });
  }
});

test('[TEAMS]: delete completed team document', async ({ page }) => {
  const { team, teamMember2: teamEmailMember, teamMember3 } = await seedTeamDocuments();

  await apiSignin({
    page,
    email: teamMember3.email,
    redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
  });

  await page.getByRole('row').getByRole('button').nth(2).click();

  await page.getByRole('menuitem', { name: 'Delete' }).click({ force: true });
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click({ force: true });

  await checkDocumentTabCount(page, 'Completed', 0);

  // Should be hidden for all team members.
  await apiSignout({ page });

  // Run the test twice, one with the team owner and once with the team member email to ensure the counts are the same.
  for (const user of [team.owner, teamEmailMember]) {
    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents`,
    });

    // Check document counts.
    await checkDocumentTabCount(page, 'Inbox', 0);
    await checkDocumentTabCount(page, 'Pending', 2);
    await checkDocumentTabCount(page, 'Completed', 0);
    await checkDocumentTabCount(page, 'Draft', 2);
    await checkDocumentTabCount(page, 'All', 4);

    await apiSignout({ page });
  }
});

test('[TEAMS]: check document visibility based on team member role', async ({ page }) => {
  const team = await seedTeam();

  // Seed users with different roles
  const adminUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.ADMIN,
  });

  const managerUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MANAGER,
  });

  const memberUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  const outsideUser = await seedUser();

  // Seed documents with different visibility levels
  await seedDocuments([
    {
      sender: team.owner,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'EVERYONE',
        title: 'Document Visible to Everyone',
      },
    },
    {
      sender: team.owner,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'MANAGER_AND_ABOVE',
        title: 'Document Visible to Manager and Above',
      },
    },
    {
      sender: team.owner,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'ADMIN',
        title: 'Document Visible to Admin',
      },
    },
    {
      sender: team.owner,
      recipients: [outsideUser],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'ADMIN',
        title: 'Document Visible to Admin with Recipient',
      },
    },
  ]);

  const teamUrlRedirect = `/t/${team.url}/documents?status=COMPLETED`;

  // Test cases for each role
  const testCases = [
    {
      user: adminUser,
      path: teamUrlRedirect,
      expectedDocuments: [
        'Document Visible to Everyone',
        'Document Visible to Manager and Above',
        'Document Visible to Admin',
        'Document Visible to Admin with Recipient',
      ],
    },
    {
      user: managerUser,
      path: teamUrlRedirect,
      expectedDocuments: ['Document Visible to Everyone', 'Document Visible to Manager and Above'],
    },
    {
      user: memberUser,
      path: teamUrlRedirect,
      expectedDocuments: ['Document Visible to Everyone'],
    },
    {
      user: outsideUser,
      path: '/documents',
      expectedDocuments: ['Document Visible to Admin with Recipient'],
    },
  ];

  for (const testCase of testCases) {
    await apiSignin({
      page,
      email: testCase.user.email,
      redirectPath: testCase.path,
    });

    // Check that the user sees the expected documents
    for (const documentTitle of testCase.expectedDocuments) {
      await expect(page.getByRole('link', { name: documentTitle, exact: true })).toBeVisible();
    }

    await apiSignout({ page });
  }
});

test('[TEAMS]: ensure document owner can see document regardless of visibility', async ({
  page,
}) => {
  const team = await seedTeam();

  // Seed a member user
  const memberUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  // Seed a document with ADMIN visibility but make the member user a recipient
  await seedDocuments([
    {
      sender: memberUser,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'ADMIN',
        title: 'Admin Document with Member Document Owner',
      },
    },
  ]);

  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
  });

  // Check that the member user can see the document
  await expect(
    page.getByRole('link', { name: 'Admin Document with Member Document Owner', exact: true }),
  ).toBeVisible();

  await apiSignout({ page });
});

test('[TEAMS]: ensure recipient can see document regardless of visibility', async ({ page }) => {
  const team = await seedTeam();

  // Seed a member user
  const memberUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  // Seed a document with ADMIN visibility but make the member user a recipient
  await seedDocuments([
    {
      sender: team.owner,
      recipients: [memberUser],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'ADMIN',
        title: 'Admin Document with Member Recipient',
      },
    },
  ]);

  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
  });

  // Check that the member user can see the document
  await expect(
    page.getByRole('link', { name: 'Admin Document with Member Recipient', exact: true }),
  ).toBeVisible();

  await apiSignout({ page });
});

test('[TEAMS]: check that MEMBER role cannot see ADMIN-only documents', async ({ page }) => {
  const team = await seedTeam();

  // Seed a member user
  const memberUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  // Seed an ADMIN-only document
  await seedDocuments([
    {
      sender: team.owner,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'ADMIN',
        title: 'Admin Only Document',
      },
    },
  ]);

  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
  });

  // Check that the member user cannot see the ADMIN-only document
  await expect(
    page.getByRole('link', { name: 'Admin Only Document', exact: true }),
  ).not.toBeVisible();

  await apiSignout({ page });
});

test('[TEAMS]: check that MEMBER role cannot see MANAGER_AND_ABOVE-only documents', async ({
  page,
}) => {
  const team = await seedTeam();

  // Seed a member user
  const memberUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  // Seed an ADMIN-only document
  await seedDocuments([
    {
      sender: team.owner,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'MANAGER_AND_ABOVE',
        title: 'Manager and Above Only Document',
      },
    },
  ]);

  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
  });

  // Check that the member user cannot see the ADMIN-only document
  await expect(
    page.getByRole('link', { name: 'Admin Only Document', exact: true }),
  ).not.toBeVisible();

  await apiSignout({ page });
});

test('[TEAMS]: check that MANAGER role cannot see ADMIN-only documents', async ({ page }) => {
  const team = await seedTeam();

  // Seed a manager user
  const managerUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MANAGER,
  });

  // Seed an ADMIN-only document
  await seedDocuments([
    {
      sender: team.owner,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'ADMIN',
        title: 'Admin Only Document',
      },
    },
  ]);

  await apiSignin({
    page,
    email: managerUser.email,
    redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
  });

  // Check that the manager user cannot see the ADMIN-only document
  await expect(
    page.getByRole('link', { name: 'Admin Only Document', exact: true }),
  ).not.toBeVisible();

  await apiSignout({ page });
});

test('[TEAMS]: check that ADMIN role can see MANAGER_AND_ABOVE documents', async ({ page }) => {
  const team = await seedTeam();

  // Seed an admin user
  const adminUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.ADMIN,
  });

  // Seed a MANAGER_AND_ABOVE document
  await seedDocuments([
    {
      sender: team.owner,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'MANAGER_AND_ABOVE',
        title: 'Manager and Above Document',
      },
    },
  ]);

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
  });

  // Check that the admin user can see the MANAGER_AND_ABOVE document
  await expect(
    page.getByRole('link', { name: 'Manager and Above Document', exact: true }),
  ).toBeVisible();

  await apiSignout({ page });
});

test('[TEAMS]: check that ADMIN role can change document visibility', async ({ page }) => {
  const team = await seedTeam({
    createTeamOptions: {
      teamGlobalSettings: {
        create: {
          documentVisibility: DocumentVisibility.MANAGER_AND_ABOVE,
        },
      },
    },
  });

  const adminUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.ADMIN,
  });

  const document = await seedBlankDocument(adminUser, {
    createDocumentOptions: {
      teamId: team.id,
      visibility: team.teamGlobalSettings?.documentVisibility,
    },
  });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
  });

  await page.getByTestId('documentVisibilitySelectValue').click();
  await page.getByLabel('Admins only').click();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  await expect(page.getByTestId('documentVisibilitySelectValue')).toContainText('Admins only');
});

test('[TEAMS]: check that MEMBER role cannot change visibility of EVERYONE documents', async ({
  page,
}) => {
  const team = await seedTeam({
    createTeamOptions: {
      teamGlobalSettings: {
        create: {
          documentVisibility: DocumentVisibility.EVERYONE,
        },
      },
    },
  });

  const teamMember = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  const document = await seedBlankDocument(teamMember, {
    createDocumentOptions: {
      teamId: team.id,
      visibility: team.teamGlobalSettings?.documentVisibility,
    },
  });

  await apiSignin({
    page,
    email: teamMember.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
  });

  await expect(page.getByTestId('documentVisibilitySelectValue')).toHaveText('Everyone');
  await expect(page.getByTestId('documentVisibilitySelectValue')).toBeDisabled();
});

test('[TEAMS]: check that MEMBER role cannot change visibility of MANAGER_AND_ABOVE documents', async ({
  page,
}) => {
  const team = await seedTeam({
    createTeamOptions: {
      teamGlobalSettings: {
        create: {
          documentVisibility: DocumentVisibility.MANAGER_AND_ABOVE,
        },
      },
    },
  });

  const teamMember = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  const document = await seedBlankDocument(teamMember, {
    createDocumentOptions: {
      teamId: team.id,
      visibility: team.teamGlobalSettings?.documentVisibility,
    },
  });

  await apiSignin({
    page,
    email: teamMember.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
  });

  await expect(page.getByTestId('documentVisibilitySelectValue')).toHaveText('Managers and above');
  await expect(page.getByTestId('documentVisibilitySelectValue')).toBeDisabled();
});

test('[TEAMS]: check that MEMBER role cannot change visibility of ADMIN documents', async ({
  page,
}) => {
  const team = await seedTeam({
    createTeamOptions: {
      teamGlobalSettings: {
        create: {
          documentVisibility: DocumentVisibility.ADMIN,
        },
      },
    },
  });

  const teamMember = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  const document = await seedBlankDocument(teamMember, {
    createDocumentOptions: {
      teamId: team.id,
      visibility: team.teamGlobalSettings?.documentVisibility,
    },
  });

  await apiSignin({
    page,
    email: teamMember.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
  });

  await expect(page.getByTestId('documentVisibilitySelectValue')).toHaveText('Admins only');
  await expect(page.getByTestId('documentVisibilitySelectValue')).toBeDisabled();
});

test('[TEAMS]: check that MANAGER role cannot change visibility of ADMIN documents', async ({
  page,
}) => {
  const team = await seedTeam({
    createTeamOptions: {
      teamGlobalSettings: {
        create: {
          documentVisibility: DocumentVisibility.ADMIN,
        },
      },
    },
  });

  const teamManager = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MANAGER,
  });

  const document = await seedBlankDocument(teamManager, {
    createDocumentOptions: {
      teamId: team.id,
      visibility: team.teamGlobalSettings?.documentVisibility,
    },
  });

  await apiSignin({
    page,
    email: teamManager.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
  });

  await expect(page.getByTestId('documentVisibilitySelectValue')).toHaveText('Admins only');
  await expect(page.getByTestId('documentVisibilitySelectValue')).toBeDisabled();
});

test('[TEAMS]: users cannot see documents from other teams', async ({ page }) => {
  // Seed two teams with documents
  const { team: teamA, teamMember2: teamAMember } = await seedTeamDocuments();
  const { team: teamB, teamMember2: teamBMember } = await seedTeamDocuments();

  // Seed a document in team B
  await seedDocuments([
    {
      sender: teamB.owner,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: teamB.id,
        visibility: 'EVERYONE',
        title: 'Team B Document',
      },
    },
  ]);

  // Sign in as a member of team A
  await apiSignin({
    page,
    email: teamAMember.email,
    redirectPath: `/t/${teamA.url}/documents?status=COMPLETED`,
  });

  // Verify that the user cannot see the document from team B
  await expect(page.getByRole('link', { name: 'Team B Document', exact: true })).not.toBeVisible();

  await apiSignout({ page });
});

test('[TEAMS]: personal documents are not visible in team context', async ({ page }) => {
  // Seed a team and a user with personal documents
  const { team, teamMember2 } = await seedTeamDocuments();
  const personalUser = await seedUser();

  // Seed a personal document for teamMember2
  await seedDocuments([
    {
      sender: teamMember2,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: null, // Indicates a personal document
        visibility: 'EVERYONE',
        title: 'Personal Document',
      },
    },
  ]);

  // Sign in as teamMember2 in the team context
  await apiSignin({
    page,
    email: teamMember2.email,
    redirectPath: `/t/${team.url}/documents?status=COMPLETED`,
  });

  // Verify that the personal document is not visible in the team context
  await expect(
    page.getByRole('link', { name: 'Personal Document', exact: true }),
  ).not.toBeVisible();

  await apiSignout({ page });
});

test('[PERSONAL]: team documents are not visible in personal account', async ({ page }) => {
  // Seed a team and a user with personal documents
  const { team, teamMember2 } = await seedTeamDocuments();

  // Seed a team document
  await seedDocuments([
    {
      sender: teamMember2,
      recipients: [],
      type: DocumentStatus.COMPLETED,
      documentOptions: {
        teamId: team.id,
        visibility: 'EVERYONE',
        title: 'Team Document',
      },
    },
  ]);

  // Sign in as teamMember2 in the personal context
  await apiSignin({
    page,
    email: teamMember2.email,
    redirectPath: `/documents?status=COMPLETED`,
  });

  // Verify that the team document is not visible in the personal context
  await expect(page.getByRole('link', { name: 'Team Document', exact: true })).not.toBeVisible();

  await apiSignout({ page });
});
