import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { seedCancelledDocument, seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Page, test } from '@playwright/test';
import { DocumentStatus, TeamMemberRole } from '@prisma/client';

import { apiSignin, apiSignout } from '../fixtures/authentication';
import { checkDocumentTabCount } from '../fixtures/documents';
import { expectToastTextToBeVisible, openDropdownMenu } from '../fixtures/generic';

test.describe.configure({ mode: 'serial' });

const seedCancelDocumentsTestRequirements = async () => {
  const [sender, recipientA, recipientB] = await Promise.all([
    seedUser({ setTeamEmailAsOwner: true }),
    seedUser({ setTeamEmailAsOwner: true }),
    seedUser({ setTeamEmailAsOwner: true }),
  ]);

  const pendingDocument = await seedPendingDocument(sender.user, sender.team.id, [recipientA.user, recipientB.user], {
    createDocumentOptions: { title: 'Document 1 - Pending' },
  });

  return {
    sender,
    recipients: [recipientA, recipientB],
    pendingDocument,
  };
};

const cancelDocumentViaUi = async (page: Page, documentTitle: string, reason?: string) => {
  const documentActionBtn = page.locator('tr', { hasText: documentTitle }).getByTestId('document-table-action-btn');

  await openDropdownMenu(page, documentActionBtn);

  await expect(page.getByRole('menuitem', { name: 'Cancel' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Cancel' }).click();

  await expect(page.getByRole('heading', { name: 'Are you sure?' })).toBeVisible();

  if (reason) {
    await page.getByPlaceholder('Add an optional reason for cancelling this document').fill(reason);
  }

  await page.getByRole('button', { name: 'Cancel document' }).click();
};

test('[DOCUMENTS]: cancelling a pending document keeps it in the owner dashboard as cancelled', async ({ page }) => {
  const { sender, pendingDocument } = await seedCancelDocumentsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await cancelDocumentViaUi(page, 'Document 1 - Pending', 'No longer required');

  await expectToastTextToBeVisible(page, 'Document cancelled');

  // The document must remain in the dashboard, unlike deleting a pending document.
  await checkDocumentTabCount(page, 'Inbox', 0);
  await checkDocumentTabCount(page, 'Pending', 0);
  await checkDocumentTabCount(page, 'Cancelled', 1);
  await checkDocumentTabCount(page, 'All', 1);

  // The cancelled document is still listed.
  await page.getByRole('tab', { name: 'Cancelled' }).click();
  await expect(page.getByRole('link', { name: 'Document 1 - Pending' })).toBeVisible();

  // The envelope status is persisted as CANCELLED.
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: pendingDocument.id,
    },
    select: {
      status: true,
      completedAt: true,
      deletedAt: true,
    },
  });

  expect(envelope.status).toBe(DocumentStatus.CANCELLED);
  expect(envelope.completedAt).not.toBeNull();
  expect(envelope.deletedAt).toBeNull();
});

test('[DOCUMENTS]: cancelling a pending document retains it for recipients', async ({ page }) => {
  const { sender, recipients } = await seedCancelDocumentsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await cancelDocumentViaUi(page, 'Document 1 - Pending');

  await expectToastTextToBeVisible(page, 'Document cancelled');

  await apiSignout({ page });

  // Recipients should still be able to see the document as a record of distribution.
  for (const recipient of recipients) {
    await apiSignin({
      page,
      email: recipient.user.email,
      redirectPath: `/t/${recipient.team.url}/documents`,
    });

    await expect(page.getByRole('link', { name: 'Document 1 - Pending' })).toBeVisible();

    await apiSignout({ page });
  }
});

test('[DOCUMENTS]: a cancelled document can be deleted, hiding it from the owner without removing it', async ({
  page,
}) => {
  const { sender, recipients, pendingDocument } = await seedCancelDocumentsTestRequirements();

  await apiSignin({
    page,
    email: sender.user.email,
    redirectPath: `/t/${sender.team.url}/documents`,
  });

  await cancelDocumentViaUi(page, 'Document 1 - Pending');
  await expectToastTextToBeVisible(page, 'Document cancelled');

  // Delete the now-cancelled document. Being terminal, it should soft delete (hide).
  await page.getByRole('tab', { name: 'Cancelled' }).click();

  const documentActionBtn = page
    .locator('tr', { hasText: 'Document 1 - Pending' })
    .getByTestId('document-table-action-btn');
  await openDropdownMenu(page, documentActionBtn);

  await expect(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click();

  await page.waitForTimeout(2500);

  await expect(page.getByRole('row', { name: /Document 1 - Pending/ })).not.toBeVisible();

  // The envelope is soft deleted, not hard deleted.
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      id: pendingDocument.id,
    },
    select: {
      status: true,
      deletedAt: true,
    },
  });

  expect(envelope.status).toBe(DocumentStatus.CANCELLED);
  expect(envelope.deletedAt).not.toBeNull();

  await apiSignout({ page });

  // Recipients should still retain the document after the owner deletes it.
  await apiSignin({
    page,
    email: recipients[0].user.email,
    redirectPath: `/t/${recipients[0].team.url}/documents`,
  });

  await expect(page.getByRole('link', { name: 'Document 1 - Pending' })).toBeVisible();
});

// ─── Visibility: a cancelled document must respect team document visibility ───

test('[DOCUMENTS]: cancelled document with ADMIN visibility is hidden from a MEMBER', async ({ page }) => {
  const { team, owner } = await seedTeam();

  const adminUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });
  const managerUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });
  const memberUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  await seedCancelledDocument(owner, team.id, [], {
    createDocumentOptions: {
      visibility: 'ADMIN',
      title: 'Cancelled Admin Only Document',
    },
  });

  // The MEMBER must NOT see the ADMIN-visibility cancelled document on any tab.
  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/documents?status=CANCELLED`,
  });

  await expect(page.getByRole('link', { name: 'Cancelled Admin Only Document', exact: true })).not.toBeVisible();

  // Also confirm it doesn't leak via the ALL tab.
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/documents`);
  await expect(page.getByRole('link', { name: 'Cancelled Admin Only Document', exact: true })).not.toBeVisible();

  await apiSignout({ page });

  // The MANAGER must NOT see an ADMIN-visibility document either.
  await apiSignin({
    page,
    email: managerUser.email,
    redirectPath: `/t/${team.url}/documents?status=CANCELLED`,
  });

  await expect(page.getByRole('link', { name: 'Cancelled Admin Only Document', exact: true })).not.toBeVisible();

  await apiSignout({ page });

  // The ADMIN must see it.
  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/t/${team.url}/documents?status=CANCELLED`,
  });

  await expect(page.getByRole('link', { name: 'Cancelled Admin Only Document', exact: true })).toBeVisible();
});

test('[DOCUMENTS]: cancelled document with MANAGER_AND_ABOVE visibility is hidden from a MEMBER', async ({ page }) => {
  const { team, owner } = await seedTeam();

  const managerUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MANAGER });
  const memberUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  await seedCancelledDocument(owner, team.id, [], {
    createDocumentOptions: {
      visibility: 'MANAGER_AND_ABOVE',
      title: 'Cancelled Manager Document',
    },
  });

  // The MEMBER must NOT see it.
  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/documents?status=CANCELLED`,
  });

  await expect(page.getByRole('link', { name: 'Cancelled Manager Document', exact: true })).not.toBeVisible();

  await apiSignout({ page });

  // The MANAGER must see it.
  await apiSignin({
    page,
    email: managerUser.email,
    redirectPath: `/t/${team.url}/documents?status=CANCELLED`,
  });

  await expect(page.getByRole('link', { name: 'Cancelled Manager Document', exact: true })).toBeVisible();
});

test('[DOCUMENTS]: a recipient sees a cancelled document regardless of restricted visibility', async ({ page }) => {
  const { team, owner } = await seedTeam();

  // A MEMBER who is also a recipient on an ADMIN-visibility document.
  const memberRecipient = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  await seedCancelledDocument(owner, team.id, [memberRecipient], {
    createDocumentOptions: {
      visibility: 'ADMIN',
      title: 'Cancelled Admin Doc With Recipient',
    },
  });

  // Even though the document is ADMIN-only, the MEMBER is a recipient, so they
  // must still see it (proof of distribution), matching completed-document behaviour.
  await apiSignin({
    page,
    email: memberRecipient.email,
    redirectPath: `/t/${team.url}/documents?status=CANCELLED`,
  });

  await expect(page.getByRole('link', { name: 'Cancelled Admin Doc With Recipient', exact: true })).toBeVisible();
});

// ─── UI gating: only privileged members see the Cancel action ────────────────

test('[DOCUMENTS]: a MEMBER does not see the Cancel action on a pending document', async ({ page }) => {
  const { team, owner } = await seedTeam();

  const memberUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.MEMBER });

  const { user: recipient } = await seedUser();

  await seedPendingDocument(owner, team.id, [recipient], {
    createDocumentOptions: { title: 'Member Gating Pending Document', visibility: 'EVERYONE' },
  });

  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/documents?status=PENDING`,
  });

  const documentActionBtn = page
    .locator('tr', { hasText: 'Member Gating Pending Document' })
    .getByTestId('document-table-action-btn');
  await openDropdownMenu(page, documentActionBtn);

  // The dropdown must render (Edit is always there) but Cancel must be absent.
  await expect(page.getByRole('menuitem', { name: 'Edit' })).toBeVisible();
  await expect(page.getByRole('menuitem', { name: 'Cancel' })).not.toBeVisible();
});

test('[DOCUMENTS]: a team ADMIN sees and can use the Cancel action on a document they do not own', async ({ page }) => {
  const { team, owner } = await seedTeam();

  const adminUser = await seedTeamMember({ teamId: team.id, role: TeamMemberRole.ADMIN });

  const { user: recipient } = await seedUser();

  const document = await seedPendingDocument(owner, team.id, [recipient], {
    createDocumentOptions: { title: 'Admin Cancellable Document', visibility: 'EVERYONE' },
  });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/t/${team.url}/documents?status=PENDING`,
  });

  await cancelDocumentViaUi(page, 'Admin Cancellable Document');

  await expectToastTextToBeVisible(page, 'Document cancelled');

  const envelope = await prisma.envelope.findFirstOrThrow({
    where: { id: document.id },
    select: { status: true },
  });

  expect(envelope.status).toBe(DocumentStatus.CANCELLED);
});
