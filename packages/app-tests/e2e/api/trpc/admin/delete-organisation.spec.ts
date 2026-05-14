import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import type { Page } from '@playwright/test';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../../../fixtures/authentication';

const WEBAPP_BASE_URL = NEXT_PUBLIC_WEBAPP_URL();

test.describe.configure({ mode: 'parallel' });

const callDeleteOrganisation = async (
  page: Page,
  input: {
    organisationId: string;
    organisationName: string;
    sendEmailToOwner: boolean;
  },
) => {
  return await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/admin.organisation.delete`, {
    headers: { 'content-type': 'application/json' },
    data: JSON.stringify({ json: input }),
  });
};

// ─── Access control ──────────────────────────────────────────────────────────

test('[ADMIN][TRPC][DELETE_ORG]: unauthenticated request is rejected with 401', async ({ page }) => {
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  // No sign-in.
  const res = await callDeleteOrganisation(page, {
    organisationId: organisation.id,
    organisationName: organisation.name,
    sendEmailToOwner: true,
  });

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBe(401);

  // Org must still exist.
  const stillExists = await prisma.organisation.findUnique({ where: { id: organisation.id } });
  expect(stillExists).not.toBeNull();

  // No deletion job must have been enqueued.
  const job = await prisma.backgroundJob.findFirst({
    where: {
      jobId: 'internal.admin-delete-organisation',
      payload: { path: ['organisationId'], equals: organisation.id },
    },
  });
  expect(job).toBeNull();
});

test('[ADMIN][TRPC][DELETE_ORG]: non-admin authenticated user is rejected with 401', async ({ page }) => {
  const { user: nonAdminUser } = await seedUser({ isAdmin: false });
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({ page, email: nonAdminUser.email });

  const res = await callDeleteOrganisation(page, {
    organisationId: organisation.id,
    organisationName: organisation.name,
    sendEmailToOwner: true,
  });

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBe(401);

  const stillExists = await prisma.organisation.findUnique({ where: { id: organisation.id } });
  expect(stillExists).not.toBeNull();

  const job = await prisma.backgroundJob.findFirst({
    where: {
      jobId: 'internal.admin-delete-organisation',
      payload: { path: ['organisationId'], equals: organisation.id },
    },
  });
  expect(job).toBeNull();
});

test('[ADMIN][TRPC][DELETE_ORG]: organisation owner (non-admin) cannot delete their own org via admin route', async ({
  page,
}) => {
  // Owners can delete via the regular organisation.delete endpoint, but the
  // ADMIN endpoint must reject them too.
  const { user: owner, organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({ page, email: owner.email });

  const res = await callDeleteOrganisation(page, {
    organisationId: organisation.id,
    organisationName: organisation.name,
    sendEmailToOwner: true,
  });

  expect(res.ok()).toBeFalsy();
  expect(res.status()).toBe(401);

  const stillExists = await prisma.organisation.findUnique({ where: { id: organisation.id } });
  expect(stillExists).not.toBeNull();
});

// ─── Validation ──────────────────────────────────────────────────────────────

test('[ADMIN][TRPC][DELETE_ORG]: admin call with mismatched name is rejected and org is preserved', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({ page, email: adminUser.email });

  const res = await callDeleteOrganisation(page, {
    organisationId: organisation.id,
    organisationName: `${organisation.name}-WRONG`,
    sendEmailToOwner: true,
  });

  expect(res.ok()).toBeFalsy();

  // Body should contain INVALID_REQUEST error.
  const body = await res.text();
  expect(body).toContain('does not match');

  const stillExists = await prisma.organisation.findUnique({ where: { id: organisation.id } });
  expect(stillExists).not.toBeNull();

  // Most importantly: no job has been enqueued for this org.
  const job = await prisma.backgroundJob.findFirst({
    where: {
      jobId: 'internal.admin-delete-organisation',
      payload: { path: ['organisationId'], equals: organisation.id },
    },
  });
  expect(job).toBeNull();
});

test('[ADMIN][TRPC][DELETE_ORG]: admin call against non-existent organisation returns NOT_FOUND', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  const res = await callDeleteOrganisation(page, {
    organisationId: 'org_does-not-exist-1234567890',
    organisationName: 'Anything',
    sendEmailToOwner: true,
  });

  expect(res.ok()).toBeFalsy();

  const body = await res.text();
  expect(body).toContain('Organisation not found');
});

test('[ADMIN][TRPC][DELETE_ORG]: zod schema rejects malformed input', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({ page, email: adminUser.email });

  // Missing organisationName and sendEmailToOwner.
  const res = await page.context().request.post(`${WEBAPP_BASE_URL}/api/trpc/admin.organisation.delete`, {
    headers: { 'content-type': 'application/json' },
    data: JSON.stringify({ json: { organisationId: 'whatever' } }),
  });

  expect(res.ok()).toBeFalsy();
  // Zod validation failures surface as 400 from tRPC.
  expect([400, 422]).toContain(res.status());
});

// ─── Happy path via tRPC (admin) ────────────────────────────────────────────

test('[ADMIN][TRPC][DELETE_ORG]: admin can delete via the tRPC endpoint directly', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({ page, email: adminUser.email });

  const res = await callDeleteOrganisation(page, {
    organisationId: organisation.id,
    organisationName: organisation.name,
    sendEmailToOwner: false,
  });

  expect(res.ok()).toBeTruthy();

  // Background job should be enqueued; wait for it to complete then verify
  // the org is gone.
  await expect
    .poll(
      async () => {
        const job = await prisma.backgroundJob.findFirst({
          where: {
            jobId: 'internal.admin-delete-organisation',
            payload: { path: ['organisationId'], equals: organisation.id },
          },
        });

        return job?.status ?? null;
      },
      { timeout: 30_000, intervals: [250, 500, 1000] },
    )
    .toBe('COMPLETED');

  const org = await prisma.organisation.findUnique({ where: { id: organisation.id } });
  expect(org).toBeNull();
});

// ─── Idempotency: calling delete twice does not throw ───────────────────────

test('[ADMIN][TRPC][DELETE_ORG]: a second delete call after deletion is harmless (NOT_FOUND or no-op)', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const { organisation } = await seedUser({ isPersonalOrganisation: false });

  await apiSignin({ page, email: adminUser.email });

  // First call succeeds.
  const first = await callDeleteOrganisation(page, {
    organisationId: organisation.id,
    organisationName: organisation.name,
    sendEmailToOwner: false,
  });
  expect(first.ok()).toBeTruthy();

  // Wait for the deletion to actually happen.
  await expect
    .poll(
      async () => {
        const org = await prisma.organisation.findUnique({ where: { id: organisation.id } });
        return org === null;
      },
      { timeout: 30_000, intervals: [250, 500, 1000] },
    )
    .toBe(true);

  // Second call: the org no longer exists, so the route should fail with
  // NOT_FOUND. It must NOT 500.
  const second = await callDeleteOrganisation(page, {
    organisationId: organisation.id,
    organisationName: organisation.name,
    sendEmailToOwner: false,
  });
  expect(second.ok()).toBeFalsy();
  expect(second.status()).not.toBe(500);

  const body = await second.text();
  expect(body).toContain('Organisation not found');
});
