import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { DocumentStatus } from '@documenso/prisma/client';
import { seedDocuments, seedTeamDocuments } from '@documenso/prisma/seed/documents';
import { seedTeamEmail, unseedTeam, unseedTeamEmail } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';

import { manualLogin, manualSignout } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

const checkDocumentTabCount = async (page: Page, tabName: string, count: number) => {
  await page.getByRole('tab', { name: tabName }).click();

  if (tabName !== 'All') {
    await expect(page.getByRole('tab', { name: tabName })).toContainText(count.toString());
  }

  if (count === 0) {
    await expect(page.getByRole('main')).toContainText(`Nothing to do`);
    return;
  }

  await expect(page.getByRole('main')).toContainText(`Showing ${count}`);
};

test('[TEAMS]: check team documents count', async ({ page }) => {
  const { team, teamMember2 } = await seedTeamDocuments();

  // Run the test twice, once with the team owner and once with a team member to ensure the counts are the same.
  for (const user of [team.owner, teamMember2]) {
    await manualLogin({
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

    await manualSignout({ page });
  }

  await unseedTeam(team.url);
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
    await manualLogin({
      page,
      email: user.email,
      redirectPath: `/t/${team.url}/documents`,
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

    await manualSignout({ page });
  }

  await unseedTeamEmail({ teamId: team.id });
  await unseedTeam(team.url);
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

  await manualLogin({
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

  await unseedTeamEmail({ teamId: team.id });
  await unseedTeam(team.url);
});

test('[TEAMS]: delete pending team document', async ({ page }) => {
  const { team, teamMember2: currentUser } = await seedTeamDocuments();

  await manualLogin({
    page,
    email: currentUser.email,
    redirectPath: `/t/${team.url}/documents?status=PENDING`,
  });

  await page.getByRole('row').getByRole('button').nth(1).click();

  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click();

  await checkDocumentTabCount(page, 'Pending', 1);
});

test('[TEAMS]: resend pending team document', async ({ page }) => {
  const { team, teamMember2: currentUser } = await seedTeamDocuments();

  await manualLogin({
    page,
    email: currentUser.email,
    redirectPath: `/t/${team.url}/documents?status=PENDING`,
  });

  await page.getByRole('row').getByRole('button').nth(1).click();
  await page.getByRole('menuitem', { name: 'Resend' }).click();

  await page.getByLabel('test.documenso.com').first().click();
  await page.getByRole('button', { name: 'Send reminder' }).click();

  await expect(page.getByRole('status')).toContainText('Document re-sent');
});
