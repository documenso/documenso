import { prisma } from '@documenso/prisma';
import { BackgroundJobStatus, DocumentStatus, EnvelopeType, Role } from '@documenso/prisma/client';
import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin, apiSignout } from '../../fixtures/authentication';

/**
 * Helper that polls until the `admin.organisation.delete` background job for the
 * supplied organisation has finished (status COMPLETED). Returns the org id.
 */
const waitForOrganisationDeletionJob = async (organisationId: string) => {
  await expect
    .poll(
      async () => {
        const job = await prisma.backgroundJob.findFirst({
          where: {
            jobId: 'internal.admin-delete-organisation',
            // payload is JSON; match the organisationId field.
            payload: {
              path: ['organisationId'],
              equals: organisationId,
            },
          },
          orderBy: { submittedAt: 'desc' },
        });

        return job?.status ?? null;
      },
      {
        message: `Background deletion job for organisation ${organisationId} did not complete in time`,
        timeout: 30_000,
        intervals: [250, 500, 1000],
      },
    )
    .toBe(BackgroundJobStatus.COMPLETED);
};

const waitForOrganisationToBeGone = async (organisationId: string) => {
  await expect
    .poll(
      async () => {
        const org = await prisma.organisation.findUnique({
          where: { id: organisationId },
          select: { id: true },
        });

        return org === null;
      },
      {
        message: `Organisation ${organisationId} was not removed`,
        timeout: 30_000,
        intervals: [250, 500, 1000],
      },
    )
    .toBe(true);
};

test.describe.configure({ mode: 'parallel' });

// ─── Happy path ──────────────────────────────────────────────────────────────

test('[ADMIN][DELETE_ORG]: admin can delete an organisation via the dialog', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  await expect(page.getByRole('heading', { name: 'Danger Zone' })).toBeVisible();

  // Open the dialog
  await page.getByRole('button', { name: 'Delete' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // The Delete submit button is initially enabled but submission should fail
  // until the confirmation text matches. Type it now.
  await dialog.getByRole('textbox').fill(`delete ${organisation.name}`);

  // The "send email to owner" checkbox should be checked by default.
  const emailCheckbox = dialog.getByRole('checkbox');
  await expect(emailCheckbox).toBeChecked();

  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

  // Dialog closes on success
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  // Background job completes and the org is removed
  await waitForOrganisationDeletionJob(organisation.id);
  await waitForOrganisationToBeGone(organisation.id);
});

// ─── Confirmation text validation ────────────────────────────────────────────

test('[ADMIN][DELETE_ORG]: typing the wrong confirmation text prevents deletion', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  await page.getByRole('button', { name: 'Delete' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Type something that does NOT match.
  await dialog.getByRole('textbox').fill('delete wrong-name');

  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

  // Validation message should appear and the dialog should stay open.
  await expect(dialog.getByText(/You must enter/)).toBeVisible();
  await expect(dialog).toBeVisible();

  // Org is still there.
  const stillExists = await prisma.organisation.findUnique({ where: { id: organisation.id } });
  expect(stillExists).not.toBeNull();
});

test('[ADMIN][DELETE_ORG]: empty confirmation text prevents deletion', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  await page.getByRole('button', { name: 'Delete' }).first().click();

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

  await expect(dialog.getByText(/You must enter/)).toBeVisible();
  await expect(dialog).toBeVisible();

  const stillExists = await prisma.organisation.findUnique({ where: { id: organisation.id } });
  expect(stillExists).not.toBeNull();
});

// ─── Cancel ──────────────────────────────────────────────────────────────────

test('[ADMIN][DELETE_ORG]: clicking Cancel closes the dialog without deleting', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  await page.getByRole('button', { name: 'Delete' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Fill in the correct text but cancel anyway.
  await dialog.getByRole('textbox').fill(`delete ${organisation.name}`);
  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await expect(dialog).not.toBeVisible();

  // Org still there.
  const stillExists = await prisma.organisation.findUnique({ where: { id: organisation.id } });
  expect(stillExists).not.toBeNull();
});

// ─── Email checkbox ──────────────────────────────────────────────────────────

test('[ADMIN][DELETE_ORG]: email checkbox can be unchecked, payload reflects choice', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  await page.getByRole('button', { name: 'Delete' }).first().click();

  const dialog = page.getByRole('dialog');
  const emailCheckbox = dialog.getByRole('checkbox');

  // Default is checked.
  await expect(emailCheckbox).toBeChecked();

  // Uncheck it.
  await emailCheckbox.click();
  await expect(emailCheckbox).not.toBeChecked();

  await dialog.getByRole('textbox').fill(`delete ${organisation.name}`);
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();

  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  // Verify the enqueued job payload has sendEmailToOwner=false.
  await expect
    .poll(
      async () => {
        const job = await prisma.backgroundJob.findFirst({
          where: {
            jobId: 'internal.admin-delete-organisation',
            payload: { path: ['organisationId'], equals: organisation.id },
          },
        });

        if (!job) {
          return null;
        }

        const payload = job.payload as { sendEmailToOwner?: boolean };
        return payload.sendEmailToOwner;
      },
      { timeout: 15_000 },
    )
    .toBe(false);

  await waitForOrganisationDeletionJob(organisation.id);
  await waitForOrganisationToBeGone(organisation.id);
});

// ─── Documents are orphaned, not deleted ─────────────────────────────────────

test('[ADMIN][DELETE_ORG]: envelopes authored by owner and members are orphaned, drafts are removed', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, organisation, team } = await seedUser({ isPersonalOrganisation: false });

  // Add two organisation members who will author their own envelopes.
  const [memberUser, managerUser] = await seedOrganisationMembers({
    organisationId: organisation.id,
    members: [{ organisationRole: 'MEMBER' }, { organisationRole: 'MANAGER' }],
  });

  // ── Owner-authored envelopes ──────────────────────────────────────────────
  const ownerCompleted = await seedBlankDocument(owner, team.id, { key: 'owner-completed' });
  await prisma.envelope.update({
    where: { id: ownerCompleted.id },
    data: { status: DocumentStatus.COMPLETED },
  });

  const ownerPending = await seedBlankDocument(owner, team.id, { key: 'owner-pending' });
  await prisma.envelope.update({
    where: { id: ownerPending.id },
    data: { status: DocumentStatus.PENDING },
  });

  const ownerDraft = await seedBlankDocument(owner, team.id, { key: 'owner-draft' });

  // ── Member-authored envelopes ─────────────────────────────────────────────
  const memberCompleted = await seedBlankDocument(memberUser, team.id, { key: 'member-completed' });
  await prisma.envelope.update({
    where: { id: memberCompleted.id },
    data: { status: DocumentStatus.COMPLETED },
  });

  const memberPending = await seedBlankDocument(memberUser, team.id, { key: 'member-pending' });
  await prisma.envelope.update({
    where: { id: memberPending.id },
    data: { status: DocumentStatus.PENDING },
  });

  const memberDraft = await seedBlankDocument(memberUser, team.id, { key: 'member-draft' });

  // ── Manager-authored envelope (third author for good measure) ─────────────
  const managerRejected = await seedBlankDocument(managerUser, team.id, { key: 'manager-rejected' });
  await prisma.envelope.update({
    where: { id: managerRejected.id },
    data: { status: DocumentStatus.REJECTED },
  });

  // Sanity check: before deletion all 7 envelopes belong to the team and
  // retain their original authors.
  const beforeCount = await prisma.envelope.count({ where: { teamId: team.id } });
  expect(beforeCount).toBe(7);

  // ── Trigger the deletion via the admin UI ─────────────────────────────────
  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  await page.getByRole('button', { name: 'Delete' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(`delete ${organisation.name}`);
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  await waitForOrganisationDeletionJob(organisation.id);
  await waitForOrganisationToBeGone(organisation.id);

  // The deleted-account service account is where orphaned envelopes land.
  const deletedAccount = await prisma.user.findFirstOrThrow({
    where: { email: { startsWith: 'deleted-account@' } },
    select: { id: true, ownedOrganisations: { select: { teams: { select: { id: true } } } } },
  });
  const deletedAccountTeamId = deletedAccount.ownedOrganisations[0].teams[0].id;

  // ── Owner-authored envelopes ──────────────────────────────────────────────
  // Completed/pending: orphaned (reparented to service account + deletedAt set).
  for (const original of [ownerCompleted, ownerPending]) {
    const after = await prisma.envelope.findUnique({
      where: { id: original.id },
      select: { id: true, teamId: true, userId: true, deletedAt: true },
    });
    expect(after, `owner envelope ${original.id} should survive as orphan`).not.toBeNull();
    expect(after?.teamId).toBe(deletedAccountTeamId);
    expect(after?.userId).toBe(deletedAccount.id);
    expect(after?.deletedAt).not.toBeNull();
  }

  // Draft: hard-deleted because orphan only re-parents PENDING/REJECTED/COMPLETED.
  const ownerDraftAfter = await prisma.envelope.findUnique({
    where: { id: ownerDraft.id },
    select: { id: true },
  });
  expect(ownerDraftAfter, 'owner draft should be hard-deleted').toBeNull();

  // ── Member-authored envelopes (the critical case) ─────────────────────────
  // The orphan logic filters by teamId only — NOT by userId — so member-authored
  // envelopes must be orphaned just like the owner's.
  for (const original of [memberCompleted, memberPending]) {
    const after = await prisma.envelope.findUnique({
      where: { id: original.id },
      select: { id: true, teamId: true, userId: true, deletedAt: true },
    });
    expect(after, `member envelope ${original.id} should survive as orphan`).not.toBeNull();
    expect(after?.teamId).toBe(deletedAccountTeamId);
    expect(after?.userId).toBe(deletedAccount.id);
    expect(after?.deletedAt).not.toBeNull();
  }

  const memberDraftAfter = await prisma.envelope.findUnique({
    where: { id: memberDraft.id },
    select: { id: true },
  });
  expect(memberDraftAfter, 'member draft should be hard-deleted').toBeNull();

  // ── Manager-authored rejected envelope: also orphaned ─────────────────────
  const managerRejectedAfter = await prisma.envelope.findUnique({
    where: { id: managerRejected.id },
    select: { id: true, teamId: true, userId: true, deletedAt: true },
  });
  expect(managerRejectedAfter).not.toBeNull();
  expect(managerRejectedAfter?.teamId).toBe(deletedAccountTeamId);
  expect(managerRejectedAfter?.userId).toBe(deletedAccount.id);

  // ── Original team is gone, member users still exist ───────────────────────
  const teamAfter = await prisma.team.findUnique({ where: { id: team.id } });
  expect(teamAfter).toBeNull();

  // No envelope should reference the now-deleted team.
  const orphanedToOldTeam = await prisma.envelope.count({ where: { teamId: team.id } });
  expect(orphanedToOldTeam).toBe(0);

  // The owner and members survive — only the org is deleted, not the users.
  const ownerAfter = await prisma.user.findUnique({ where: { id: owner.id } });
  const memberAfter = await prisma.user.findUnique({ where: { id: memberUser.id } });
  const managerAfter = await prisma.user.findUnique({ where: { id: managerUser.id } });
  expect(ownerAfter).not.toBeNull();
  expect(memberAfter).not.toBeNull();
  expect(managerAfter).not.toBeNull();
});

// ─── Owner can no longer access the deleted organisation ─────────────────────

test('[ADMIN][DELETE_ORG]: the original owner loses access after deletion', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  await page.getByRole('button', { name: 'Delete' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(`delete ${organisation.name}`);
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  await waitForOrganisationDeletionJob(organisation.id);
  await waitForOrganisationToBeGone(organisation.id);

  // Sign in as the original owner and confirm they can no longer reach the
  // organisation settings page.
  await apiSignout({ page });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/o/${organisation.url}/settings/general`,
  });

  // They should NOT see the organisation settings heading for this org.
  await expect(page.getByText('Organisation Settings')).not.toBeVisible();
});

// ─── Access control: UI ──────────────────────────────────────────────────────

test('[ADMIN][DELETE_ORG]: non-admin user cannot access /admin/organisations/$id', async ({ page }) => {
  const { user: nonAdminUser } = await seedUser({ isAdmin: false });
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({
    page,
    email: nonAdminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  // The admin layout loader redirects non-admins to "/". They must not see the
  // admin panel or any Delete affordance.
  await expect(page.getByRole('heading', { name: 'Admin Panel' })).not.toBeVisible();
  await expect(page.getByRole('heading', { name: 'Danger Zone' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible();

  // The org must still exist.
  const stillExists = await prisma.organisation.findUnique({ where: { id: organisation.id } });
  expect(stillExists).not.toBeNull();
});

test('[ADMIN][DELETE_ORG]: unauthenticated user cannot access /admin/organisations/$id', async ({ page }) => {
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  // No apiSignin call. Navigate directly.
  await page.goto(`/admin/organisations/${organisation.id}`);

  // Unauthenticated requests should be redirected away from any /admin/* route.
  await expect(page).not.toHaveURL(new RegExp(`/admin/organisations/${organisation.id}`));
  await expect(page.getByRole('heading', { name: 'Danger Zone' })).not.toBeVisible();

  const stillExists = await prisma.organisation.findUnique({ where: { id: organisation.id } });
  expect(stillExists).not.toBeNull();
});

// ─── Belt-and-braces: organisation owner (without admin role) can't use it ──

test('[ADMIN][DELETE_ORG]: an organisation owner without admin role cannot reach the admin delete UI', async ({
  page,
}) => {
  const { user: owner, organisation } = await seedUser({ isPersonalOrganisation: false });

  // Confirm the owner is NOT an admin (sanity check on the seed).
  expect(owner.roles).not.toContain(Role.ADMIN);

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  await expect(page.getByRole('heading', { name: 'Danger Zone' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Delete' })).not.toBeVisible();

  const stillExists = await prisma.organisation.findUnique({ where: { id: organisation.id } });
  expect(stillExists).not.toBeNull();
});

// ─── Org with multiple members triggers email to the OWNER only ─────────────

test('[ADMIN][DELETE_ORG]: job payload targets the organisation owner for the email notification', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, organisation } = await seedUser({ isPersonalOrganisation: false });

  await seedOrganisationMembers({
    organisationId: organisation.id,
    members: [{ organisationRole: 'MEMBER' }, { organisationRole: 'ADMIN' }, { organisationRole: 'MANAGER' }],
  });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  await page.getByRole('button', { name: 'Delete' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(`delete ${organisation.name}`);
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  // The job payload should record the admin who requested the delete and
  // sendEmailToOwner=true. (Verifying the actual email send is out of scope
  // for this test; we verify the payload only.)
  await expect
    .poll(
      async () => {
        const job = await prisma.backgroundJob.findFirst({
          where: {
            jobId: 'internal.admin-delete-organisation',
            payload: { path: ['organisationId'], equals: organisation.id },
          },
        });

        if (!job) {
          return null;
        }

        const payload = job.payload as {
          sendEmailToOwner?: boolean;
          requestedByUserId?: number;
        };

        return payload;
      },
      { timeout: 15_000 },
    )
    .toMatchObject({
      sendEmailToOwner: true,
      requestedByUserId: adminUser.id,
    });

  await waitForOrganisationDeletionJob(organisation.id);
  await waitForOrganisationToBeGone(organisation.id);

  // Owner user record itself is NOT deleted — only the org.
  const ownerStillExists = await prisma.user.findUnique({ where: { id: owner.id } });
  expect(ownerStillExists).not.toBeNull();
});

// ─── EnvelopeType.TEMPLATE is also cleaned up via orphan flow ───────────────

test('[ADMIN][DELETE_ORG]: template envelopes are removed (not orphaned)', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { user: owner, organisation, team } = await seedUser({ isPersonalOrganisation: false });

  // Create a TEMPLATE envelope. orphanEnvelopes only re-parents DOCUMENT
  // envelopes; templates fall into the "deleteMany" path.
  const draftDoc = await seedBlankDocument(owner, team.id, { key: 'tmpl' });
  await prisma.envelope.update({
    where: { id: draftDoc.id },
    data: { type: EnvelopeType.TEMPLATE },
  });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: `/admin/organisations/${organisation.id}`,
  });

  await page.getByRole('button', { name: 'Delete' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByRole('textbox').fill(`delete ${organisation.name}`);
  await dialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(dialog).not.toBeVisible({ timeout: 10_000 });

  await waitForOrganisationDeletionJob(organisation.id);
  await waitForOrganisationToBeGone(organisation.id);

  const templateAfter = await prisma.envelope.findUnique({
    where: { id: draftDoc.id },
    select: { id: true },
  });

  expect(templateAfter).toBeNull();
});
