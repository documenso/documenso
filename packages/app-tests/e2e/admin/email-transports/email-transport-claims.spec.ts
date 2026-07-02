import { encryptEmailTransportConfig } from '@documenso/lib/server-only/email/email-transport-config';
import { generateDatabaseId, nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Locator, type Page, test } from '@playwright/test';

import { apiSignin } from '../../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

// ─── Cleanup ─────────────────────────────────────────────────────────────────

// Transports seeded by the current test, deleted afterwards. Deleting a transport
// referenced by a claim is safe: the FK is `onDelete: SetNull`.
const transportIdsToCleanup: string[] = [];

test.afterEach(async () => {
  if (transportIdsToCleanup.length > 0) {
    await prisma.emailTransport.deleteMany({ where: { id: { in: transportIdsToCleanup } } });
    transportIdsToCleanup.length = 0;
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const seedTransport = async (label: string) => {
  const transport = await prisma.emailTransport.create({
    data: {
      id: generateDatabaseId('email_transport'),
      name: `e2e-transport-${label}-${nanoid()}`,
      type: 'RESEND',
      fromName: 'Seeded Transport',
      fromAddress: 'seeded@example.com',
      config: encryptEmailTransportConfig({ type: 'RESEND', apiKey: `re_${nanoid()}` }),
    },
  });

  transportIdsToCleanup.push(transport.id);

  return transport;
};

const seedSubscriptionClaim = (name: string) =>
  prisma.subscriptionClaim.create({
    data: {
      name,
      teamCount: 1,
      memberCount: 1,
      envelopeItemCount: 10,
      recipientCount: 10,
      flags: {},
      documentRateLimits: [],
      emailRateLimits: [],
      apiRateLimits: [],
    },
  });

/**
 * Seeds an organisation whose `OrganisationClaim` is descended (via
 * `originalSubscriptionClaimId`) from the supplied subscription claim. This is
 * the relationship the backport `updateMany` keys on.
 */
const seedOrgForClaim = async (subscriptionClaimId: string) => {
  const { organisation } = await seedUser();

  await prisma.organisationClaim.update({
    where: { id: organisation.organisationClaim.id },
    data: {
      originalSubscriptionClaimId: subscriptionClaimId,
      emailTransportId: null,
    },
  });

  return organisation;
};

const openClaimUpdateDialog = async (page: Page, claimName: string) => {
  // The update dialog lives inside the table row. Wait for the debounced search
  // refetch to land BEFORE opening it, otherwise the table re-renders mid-flow
  // and unmounts the dialog.
  const searchSettled = page
    .waitForResponse((r) => r.url().includes('claims.find') && r.url().includes(claimName), { timeout: 15_000 })
    .catch(() => undefined);

  await page.getByPlaceholder('Search by claim ID or name').fill(claimName);
  await searchSettled;

  const row = page.getByRole('row', { name: claimName });
  await expect(row).toBeVisible();

  // The actions dropdown trigger is the last button in the row (the first is the
  // ID copy button).
  await row.getByRole('button').last().click();
  await page.getByRole('menuitem', { name: 'Update' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Update Subscription Claim' })).toBeVisible();

  return dialog;
};

/**
 * Picks an option from an open Radix Select listbox. The email-transport list is
 * populated by a `find` query that can keep re-rendering (it loads up to 100
 * transports), so the target option's box may still be shifting — wait for it,
 * best-effort scroll it into view, then force the click.
 */
const chooseOption = async (page: Page, name: string) => {
  const option = page.getByRole('option', { name });
  await option.waitFor({ state: 'visible' });
  await option.scrollIntoViewIfNeeded().catch(() => undefined);
  await option.click({ force: true });
};

const selectEmailTransport = async (page: Page, dialog: Locator, transportName: string) => {
  await dialog.getByRole('combobox').filter({ hasText: 'Default (system mailer)' }).click();
  await chooseOption(page, transportName);
};

// ─── Subscription claim: NO backport ─────────────────────────────────────────

test('[ADMIN][EMAIL_TRANSPORT]: updating a subscription claim WITHOUT backport does not touch organisation claims', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const transport = await seedTransport('no-backport');
  const claimName = `e2e-claim-no-backport-${nanoid()}`;
  const claim = await seedSubscriptionClaim(claimName);
  const organisation = await seedOrgForClaim(claim.id);

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/claims' });

  const dialog = await openClaimUpdateDialog(page, claimName);

  await selectEmailTransport(page, dialog, transport.name);

  // Backport checkbox left UNCHECKED.
  await expect(dialog.getByRole('checkbox', { name: 'Backport email transport' })).not.toBeChecked();

  await dialog.getByRole('button', { name: 'Update Claim' }).click();
  await expect(dialog).not.toBeVisible();

  // The subscription claim itself was updated (proves the mutation ran).
  await expect
    .poll(async () => {
      const updated = await prisma.subscriptionClaim.findUniqueOrThrow({ where: { id: claim.id } });
      return updated.emailTransportId;
    })
    .toBe(transport.id);

  // The organisation claim was NOT backported.
  const orgClaim = await prisma.organisationClaim.findFirstOrThrow({
    where: { id: organisation.organisationClaim.id },
  });
  expect(orgClaim.emailTransportId).toBeNull();
});

// ─── Subscription claim: WITH backport ───────────────────────────────────────

test('[ADMIN][EMAIL_TRANSPORT]: updating a subscription claim WITH backport propagates to organisation claims', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const transport = await seedTransport('backport');
  const claimName = `e2e-claim-backport-${nanoid()}`;
  const claim = await seedSubscriptionClaim(claimName);
  const organisation = await seedOrgForClaim(claim.id);

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/claims' });

  const dialog = await openClaimUpdateDialog(page, claimName);

  await selectEmailTransport(page, dialog, transport.name);

  // Enable backporting.
  const backportCheckbox = dialog.getByRole('checkbox', { name: 'Backport email transport' });
  await backportCheckbox.click();
  await expect(backportCheckbox).toBeChecked();

  await dialog.getByRole('button', { name: 'Update Claim' }).click();
  await expect(dialog).not.toBeVisible();

  // Both the subscription claim AND the descendant organisation claim are updated.
  await expect
    .poll(async () => {
      const updated = await prisma.subscriptionClaim.findUniqueOrThrow({ where: { id: claim.id } });
      return updated.emailTransportId;
    })
    .toBe(transport.id);

  await expect
    .poll(async () => {
      const orgClaim = await prisma.organisationClaim.findFirstOrThrow({
        where: { id: organisation.organisationClaim.id },
      });
      return orgClaim.emailTransportId;
    })
    .toBe(transport.id);
});

// ─── Organisation claim transport (set directly on the org page) ─────────────

test('[ADMIN][EMAIL_TRANSPORT]: setting the email transport on an organisation claim persists', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const transport = await seedTransport('org-claim');
  const { organisation } = await seedUser();

  // Ensure a known starting point.
  await prisma.organisationClaim.update({
    where: { id: organisation.organisationClaim.id },
    data: { emailTransportId: null },
  });

  await apiSignin({ page, email: adminUser.email, redirectPath: `/admin/organisations/${organisation.id}` });

  // Scope to the billing/claims form (the one containing the "Email transport" field);
  // the page has a second form (name/url) with its own "Update" button.
  const billingForm = page.locator('form', { has: page.getByText('Email transport', { exact: true }) });

  await billingForm.getByRole('combobox').filter({ hasText: 'Default (system mailer)' }).click();
  await chooseOption(page, transport.name);

  await billingForm.getByRole('button', { name: 'Update', exact: true }).click();

  await expect
    .poll(async () => {
      const orgClaim = await prisma.organisationClaim.findFirstOrThrow({
        where: { id: organisation.organisationClaim.id },
      });
      return orgClaim.emailTransportId;
    })
    .toBe(transport.id);
});

// ─── Organisation claim transport can be reset to the system mailer ──────────

test('[ADMIN][EMAIL_TRANSPORT]: clearing an organisation claim transport resets it to the system mailer', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const transport = await seedTransport('org-clear');
  const { organisation } = await seedUser();

  // Start with the transport already assigned.
  await prisma.organisationClaim.update({
    where: { id: organisation.organisationClaim.id },
    data: { emailTransportId: transport.id },
  });

  await apiSignin({ page, email: adminUser.email, redirectPath: `/admin/organisations/${organisation.id}` });

  const billingForm = page.locator('form', { has: page.getByText('Email transport', { exact: true }) });

  // The select currently shows the transport name; switch back to the default.
  await billingForm.getByRole('combobox').filter({ hasText: transport.name }).click();
  await chooseOption(page, 'Default (system mailer)');

  await billingForm.getByRole('button', { name: 'Update', exact: true }).click();

  await expect
    .poll(async () => {
      const orgClaim = await prisma.organisationClaim.findFirstOrThrow({
        where: { id: organisation.organisationClaim.id },
      });
      return orgClaim.emailTransportId;
    })
    .toBeNull();
});
