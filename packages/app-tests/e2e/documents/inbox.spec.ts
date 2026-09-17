import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import {
  seedCancelledDocument,
  seedCompletedDocument,
  seedDraftDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';
import { RecipientRole, TeamMemberRole } from '@prisma/client';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({
  mode: 'parallel',
});

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

const DEFAULT_EMPTY_STATE = 'Documents that require your attention will appear here';
const COMPLETED_EMPTY_STATE = 'Documents that you have completed will appear here';
const SEARCH_EMPTY_STATE = 'No documents match your search';

const inboxRow = (page: Page, title: string) => page.getByRole('row').filter({ hasText: title });

const searchInbox = async (page: Page, query: string) => {
  await page.getByPlaceholder('Search documents...').fill(query);

  // An empty search removes the param entirely.
  await page.waitForURL((url) => (url.searchParams.get('query') ?? '') === query);
};

const selectInboxStatus = async (page: Page, statusName: 'Pending' | 'Completed' | 'Rejected' | 'Cancelled') => {
  await page.getByTestId('documents-table-status-filter').click();
  await page.getByRole('option', { name: statusName }).click();
  await page.waitForURL((url) => url.searchParams.get('status') === statusName.toUpperCase());
};

// ─── Behaviour ───────────────────────────────────────────────────────────────

test.describe('Inbox - Search & Status Filter', () => {
  test('should show every non-draft document by default', async ({ page }) => {
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: recipient } = await seedUser();

    await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Inbox Pending Document' },
    });

    await seedCompletedDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Inbox Completed Document' },
    });

    await seedCancelledDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Inbox Cancelled Document' },
    });

    await seedDraftDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Inbox Draft Document' },
    });

    await apiSignin({ page, email: recipient.email, redirectPath: '/inbox' });

    // No status selected by default.
    expect(new URL(page.url()).searchParams.get('status')).toBeNull();
    await expect(page.getByTestId('documents-table-status-filter')).toHaveText('Status');

    await expect(inboxRow(page, 'Inbox Pending Document')).toBeVisible();
    await expect(inboxRow(page, 'Inbox Completed Document')).toBeVisible();
    await expect(inboxRow(page, 'Inbox Cancelled Document')).toBeVisible();
    await expect(inboxRow(page, 'Inbox Draft Document')).not.toBeVisible();

    await selectInboxStatus(page, 'Completed');

    await expect(page.getByTestId('documents-table-status-filter')).toContainText('Completed');
    await expect(inboxRow(page, 'Inbox Completed Document')).toBeVisible();
    await expect(inboxRow(page, 'Inbox Pending Document')).not.toBeVisible();
    await expect(inboxRow(page, 'Inbox Cancelled Document')).not.toBeVisible();

    await selectInboxStatus(page, 'Cancelled');

    await expect(inboxRow(page, 'Inbox Cancelled Document')).toBeVisible();
    await expect(inboxRow(page, 'Inbox Pending Document')).not.toBeVisible();
    await expect(inboxRow(page, 'Inbox Completed Document')).not.toBeVisible();

    // Clearing the filter returns to every non-draft document.
    await page.getByTestId('documents-table-status-filter').click();
    await page.getByRole('option', { name: 'Clear' }).click();
    await page.waitForURL((url) => url.searchParams.get('status') === null);

    await expect(page.getByTestId('documents-table-status-filter')).toHaveText('Status');
    await expect(inboxRow(page, 'Inbox Pending Document')).toBeVisible();
    await expect(inboxRow(page, 'Inbox Completed Document')).toBeVisible();
    await expect(inboxRow(page, 'Inbox Cancelled Document')).toBeVisible();
    await expect(inboxRow(page, 'Inbox Draft Document')).not.toBeVisible();
  });

  test('should offer every status except draft', async ({ page }) => {
    const { user } = await seedUser();

    await apiSignin({ page, email: user.email, redirectPath: '/inbox' });

    await page.getByTestId('documents-table-status-filter').click();

    for (const visibleStatus of ['Pending', 'Completed', 'Rejected', 'Cancelled']) {
      await expect(page.getByRole('option', { name: visibleStatus, exact: true })).toBeVisible();
    }

    for (const hiddenStatus of ['Draft', 'Inbox', 'All', 'Expired']) {
      await expect(page.getByRole('option', { name: hiddenStatus, exact: true })).not.toBeVisible();
    }
  });

  test('should filter documents by title', async ({ page }) => {
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: recipient } = await seedUser();

    await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Alpha Agreement' },
    });

    await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Beta Agreement' },
    });

    await apiSignin({ page, email: recipient.email, redirectPath: '/inbox' });

    await expect(inboxRow(page, 'Alpha Agreement')).toBeVisible();
    await expect(inboxRow(page, 'Beta Agreement')).toBeVisible();

    await searchInbox(page, 'alpha');

    await expect(inboxRow(page, 'Alpha Agreement')).toBeVisible();
    await expect(inboxRow(page, 'Beta Agreement')).not.toBeVisible();

    await searchInbox(page, 'Gamma');

    await expect(page.getByText(SEARCH_EMPTY_STATE)).toBeVisible();

    // Search is combined with the status filter.
    await selectInboxStatus(page, 'Completed');
    await searchInbox(page, 'Agreement');

    await expect(page.getByText(SEARCH_EMPTY_STATE)).toBeVisible();
    await expect(inboxRow(page, 'Alpha Agreement')).not.toBeVisible();

    // Clearing the search shows the status specific empty state.
    await searchInbox(page, '');

    await expect(page.getByText(COMPLETED_EMPTY_STATE)).toBeVisible();
  });
});

// ─── Adversarial ─────────────────────────────────────────────────────────────

test.describe('Inbox - Adversarial Access', () => {
  test('should not leak another user documents through search', async ({ page }) => {
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: victim } = await seedUser();
    const { user: attacker } = await seedUser();

    await seedPendingDocument(sender, senderTeam.id, [victim], {
      createDocumentOptions: { title: 'Confidential Merger Agreement' },
    });

    await seedCompletedDocument(sender, senderTeam.id, [victim], {
      createDocumentOptions: { title: 'Confidential Severance Package' },
    });

    // Attacker lands directly on a crafted URL with the exact title.
    await apiSignin({
      page,
      email: attacker.email,
      redirectPath: '/inbox?query=Confidential%20Merger%20Agreement',
    });

    await expect(page.getByText(SEARCH_EMPTY_STATE)).toBeVisible();
    await expect(inboxRow(page, 'Confidential Merger Agreement')).not.toBeVisible();

    await page.goto(`${WEBAPP_BASE_URL}/inbox?query=Confidential&status=COMPLETED`);

    await expect(page.getByText(SEARCH_EMPTY_STATE)).toBeVisible();
    await expect(inboxRow(page, 'Confidential Severance Package')).not.toBeVisible();

    // Wildcards must not widen the search to everything.
    await page.goto(`${WEBAPP_BASE_URL}/inbox?query=%25`);

    await expect(page.getByText(SEARCH_EMPTY_STATE)).toBeVisible();
    await expect(page.getByText('Confidential', { exact: false })).not.toBeVisible();
  });

  test('should ignore tampered status values', async ({ page }) => {
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: recipient } = await seedUser();

    // The recipient is attached to a draft that has not been sent yet. It must
    // never be reachable via the URL, regardless of the status requested.
    await seedDraftDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Unsent Draft Document' },
    });

    await seedCancelledDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Cancelled Document' },
    });

    await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Legit Pending Document' },
    });

    // Draft, virtual and derived statuses are ignored, showing the unfiltered
    // non-draft view. Kept to a handful of full page loads per test since each
    // one is a fresh navigation.
    const expectUnfilteredView = async () => {
      await expect(page.getByTestId('documents-table-status-filter')).toHaveText('Status');
      await expect(inboxRow(page, 'Legit Pending Document')).toBeVisible();
      await expect(inboxRow(page, 'Cancelled Document')).toBeVisible();
      await expect(inboxRow(page, 'Unsent Draft Document')).not.toBeVisible();
    };

    await apiSignin({ page, email: recipient.email, redirectPath: '/inbox?status=DRAFT' });
    await expectUnfilteredView();

    await page.goto(`${WEBAPP_BASE_URL}/inbox?status=ALL`);
    await expectUnfilteredView();

    await page.goto(`${WEBAPP_BASE_URL}/inbox?status=EXPIRED`);
    await expectUnfilteredView();

    // Searching by the exact title of the draft must not surface it either.
    await searchInbox(page, 'Unsent Draft');
    await expect(page.getByText(SEARCH_EMPTY_STATE)).toBeVisible();

    // Supported non-pending statuses are scoped to exactly that status.
    await page.goto(`${WEBAPP_BASE_URL}/inbox?status=CANCELLED`);

    await expect(page.getByTestId('documents-table-status-filter')).toContainText('Cancelled');
    await expect(inboxRow(page, 'Cancelled Document')).toBeVisible();
    await expect(inboxRow(page, 'Legit Pending Document')).not.toBeVisible();
    await expect(inboxRow(page, 'Unsent Draft Document')).not.toBeVisible();
  });

  test('should not show deleted or CC documents even when searched by exact title', async ({ page }) => {
    const { user: sender, team: senderTeam } = await seedUser();
    const { user: recipient } = await seedUser();

    const deletedDocument = await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'Deleted Pending Document' },
    });

    await prisma.envelope.update({
      where: { id: deletedDocument.id },
      data: { deletedAt: new Date() },
    });

    const ccDocument = await seedPendingDocument(sender, senderTeam.id, [recipient], {
      createDocumentOptions: { title: 'CC Only Pending Document' },
    });

    await prisma.recipient.updateMany({
      where: { envelopeId: ccDocument.id, email: recipient.email },
      data: { role: RecipientRole.CC },
    });

    await apiSignin({ page, email: recipient.email, redirectPath: '/inbox' });

    await expect(page.getByText(DEFAULT_EMPTY_STATE)).toBeVisible();

    await page.goto(`${WEBAPP_BASE_URL}/inbox?query=Deleted%20Pending`);
    await expect(page.getByText(SEARCH_EMPTY_STATE)).toBeVisible();
    await expect(inboxRow(page, 'Deleted Pending Document')).not.toBeVisible();

    await page.goto(`${WEBAPP_BASE_URL}/inbox?query=CC%20Only`);
    await expect(page.getByText(SEARCH_EMPTY_STATE)).toBeVisible();
    await expect(inboxRow(page, 'CC Only Pending Document')).not.toBeVisible();
  });

  test('should not show team documents to team members who are not recipients', async ({ page }) => {
    const { team, owner } = await seedTeam();
    const { user: outsideRecipient } = await seedUser();

    const teamAdmin = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });

    await seedPendingDocument(owner, team.id, [outsideRecipient], {
      createDocumentOptions: { title: 'Team Payroll Summary' },
    });

    await seedCompletedDocument(owner, team.id, [outsideRecipient], {
      createDocumentOptions: { title: 'Team Board Minutes' },
    });

    // A team admin sees these on the team documents page, but the personal
    // inbox is strictly recipient scoped.
    await apiSignin({ page, email: teamAdmin.email, redirectPath: '/inbox?query=Team' });

    await expect(page.getByText(SEARCH_EMPTY_STATE)).toBeVisible();
    await expect(inboxRow(page, 'Team Payroll Summary')).not.toBeVisible();

    await page.goto(`${WEBAPP_BASE_URL}/inbox?query=Team&status=COMPLETED`);

    await expect(page.getByText(SEARCH_EMPTY_STATE)).toBeVisible();
    await expect(inboxRow(page, 'Team Board Minutes')).not.toBeVisible();

    // Positive control: the actual recipient can find both.
    await page.context().clearCookies();
    await apiSignin({ page, email: outsideRecipient.email, redirectPath: '/inbox?query=Team' });

    await expect(inboxRow(page, 'Team Payroll Summary')).toBeVisible();

    await page.goto(`${WEBAPP_BASE_URL}/inbox?query=Team&status=COMPLETED`);

    await expect(inboxRow(page, 'Team Board Minutes')).toBeVisible();
  });

  test('should redirect unauthenticated users away from the inbox', async ({ page }) => {
    await page.goto(`${WEBAPP_BASE_URL}/inbox?query=Confidential&status=COMPLETED`);

    await expect(page).toHaveURL(/\/signin/);
  });
});
