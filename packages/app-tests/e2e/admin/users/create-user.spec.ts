import { prisma } from '@documenso/prisma';
import { seedTestEmail, seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

/**
 * Fill in the create-user dialog and submit it.
 * Assumes the dialog trigger is already visible on the page.
 */
const submitCreateUserDialog = async ({
  page,
  email,
  name,
}: {
  page: import('@playwright/test').Page;
  email: string;
  name: string;
}) => {
  await page.getByRole('button', { name: 'Create User' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  await dialog.getByLabel('Email').fill(email);
  await dialog.getByLabel('Name').fill(name);

  await dialog.getByTestId('dialog-create-user-button').click();
};

// ─── Happy path ──────────────────────────────────────────────────────────────

test('[ADMIN][CREATE_USER]: admin can create a new user via the dialog', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const newUserEmail = seedTestEmail();
  const newUserName = 'New Created User';

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: '/admin/users',
  });

  await expect(page.getByRole('heading', { name: 'Manage users' })).toBeVisible();

  await submitCreateUserDialog({ page, email: newUserEmail, name: newUserName });

  // After success the dialog closes and we navigate to /admin/users/:id.
  await expect(page).toHaveURL(/\/admin\/users\/\d+$/, { timeout: 10_000 });

  // The user-detail page renders the user's name in the heading.
  await expect(page.getByRole('heading', { name: `Manage ${newUserName}'s profile` })).toBeVisible();

  // The user exists in the database.
  const created = await prisma.user.findUnique({
    where: { email: newUserEmail.toLowerCase() },
  });

  expect(created).not.toBeNull();
  expect(created?.name).toBe(newUserName);
});

// ─── emailVerified is set + password is null for admin-created users ────────

test('[ADMIN][CREATE_USER]: a newly created user has emailVerified set and no password', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const newUserEmail = seedTestEmail();

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: '/admin/users',
  });

  await submitCreateUserDialog({
    page,
    email: newUserEmail,
    name: 'Pending Password User',
  });

  // Wait for redirect to confirm the request finished.
  await expect(page).toHaveURL(/\/admin\/users\/\d+$/, { timeout: 10_000 });

  // Admin-created users start with:
  //  - emailVerified set (the admin vouches for the email)
  //  - password null (user must set it via the welcome email reset link)
  // The "password=null" state hard-blocks login at email-password.ts:101,
  // forcing the user through the reset-link flow before they can sign in.
  const created = await prisma.user.findUnique({
    where: { email: newUserEmail.toLowerCase() },
    select: { id: true, emailVerified: true, password: true },
  });

  expect(created, 'user should exist in the database').not.toBeNull();
  expect(
    created?.emailVerified,
    'admin-created user should have emailVerified set — admin vouches for the email',
  ).not.toBeNull();
  expect(
    created?.password,
    'admin-created user must have password=null — they must set one via the welcome reset link',
  ).toBeNull();
});

// ─── Welcome email side effect: a PasswordResetToken is issued ───────────────

test('[ADMIN][CREATE_USER]: creating a user issues a PasswordResetToken valid for ~24 hours', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });
  const newUserEmail = seedTestEmail();

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: '/admin/users',
  });

  const beforeCreation = Date.now();

  await submitCreateUserDialog({
    page,
    email: newUserEmail,
    name: 'Token Recipient',
  });

  await expect(page).toHaveURL(/\/admin\/users\/\d+$/, { timeout: 10_000 });

  const created = await prisma.user.findUniqueOrThrow({
    where: { email: newUserEmail.toLowerCase() },
    select: { id: true },
  });

  // The PasswordResetToken is created by an async background job
  // (send.admin.user.created.email), so poll until it shows up.
  await expect
    .poll(
      async () => {
        const found = await prisma.passwordResetToken.findFirst({
          where: { userId: created.id },
        });
        return found === null ? null : 'found';
      },
      {
        message: `PasswordResetToken for user ${created.id} was not created by the welcome-email job in time`,
        timeout: 30_000,
        intervals: [250, 500, 1000],
      },
    )
    .toBe('found');

  // Now that we know it exists, fetch it with strict types.
  const token = await prisma.passwordResetToken.findFirstOrThrow({
    where: { userId: created.id },
  });

  // Token should be ~24h in the future (allow a generous fudge window).
  const expiry = token.expiry.getTime();
  const expectedExpiry = beforeCreation + 24 * 60 * 60 * 1000;
  const driftMs = Math.abs(expiry - expectedExpiry);

  // Allow up to 5 minutes of drift (test setup, db round-trips, clock skew,
  // plus job scheduling delay).
  expect(driftMs, `token expiry should be ~24h from now, drift was ${driftMs}ms`).toBeLessThan(5 * 60 * 1000);

  // The token value should be a non-trivial hex string.
  expect(token.token.length).toBeGreaterThanOrEqual(32);
  expect(token.token).toMatch(/^[a-f0-9]+$/);
});

// ─── Duplicate email is rejected ─────────────────────────────────────────────

test('[ADMIN][CREATE_USER]: creating a user with an email that already exists is rejected', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  // Seed an existing user whose email we'll collide with.
  const { user: existingUser } = await seedUser({ isPersonalOrganisation: true });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: '/admin/users',
  });

  await submitCreateUserDialog({
    page,
    email: existingUser.email,
    name: 'Collision Attempt',
  });

  // The dialog should stay open OR an error toast should surface. Either way
  // we must NOT navigate to a new user detail page.
  await page.waitForTimeout(1000);
  await expect(page).not.toHaveURL(/\/admin\/users\/\d+$/);

  // The existing user record must not have been mutated by the attempt.
  const stillExisting = await prisma.user.findUnique({
    where: { email: existingUser.email },
    select: { id: true, name: true, emailVerified: true },
  });

  expect(stillExisting?.id).toBe(existingUser.id);
  expect(stillExisting?.name).toBe(existingUser.name);
  // The seeded user was verified — make sure the failed create didn't
  // somehow flip the flag.
  expect(stillExisting?.emailVerified).not.toBeNull();

  // Count of users with this email must still be 1.
  const matching = await prisma.user.count({
    where: { email: existingUser.email },
  });
  expect(matching).toBe(1);
});

// ─── Validation: empty form ──────────────────────────────────────────────────

test('[ADMIN][CREATE_USER]: submitting an empty form shows validation errors and does not create a user', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: '/admin/users',
  });

  await page.getByRole('button', { name: 'Create User' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Submit without filling anything.
  await dialog.getByTestId('dialog-create-user-button').click();

  // Validation errors are surfaced for both required fields. Their presence
  // proves react-hook-form's zodResolver blocked the submit before the
  // mutation ran, so no DB write could have happened.
  await expect(dialog.getByLabel('Email')).toHaveAttribute('aria-invalid', 'true');
  await expect(dialog.getByLabel('Name')).toHaveAttribute('aria-invalid', 'true');

  // Dialog stays open and we must not have navigated to a user detail page.
  await expect(dialog).toBeVisible();
  await expect(page).not.toHaveURL(/\/admin\/users\/\d+$/);
});

// ─── Validation: malformed email ─────────────────────────────────────────────

test('[ADMIN][CREATE_USER]: a malformed email is rejected client-side', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: '/admin/users',
  });

  await page.getByRole('button', { name: 'Create User' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  const emailInput = dialog.getByLabel('Email');

  await emailInput.fill('not-an-email');
  await dialog.getByLabel('Name').fill('Some Name');

  // The Email input is rendered with type="email" and the form does not set
  // noValidate, so the browser's native HTML5 constraint validation rejects
  // the malformed value and blocks the submit event from ever firing. (As a
  // result react-hook-form's zodResolver never runs and `aria-invalid` is
  // not flipped to true — the browser is the layer doing the rejection.) We
  // assert directly on the input's ValidityState to prove the value is
  // recognised as invalid client-side.
  await expect(emailInput).toHaveJSProperty('validity.valid', false);

  await dialog.getByTestId('dialog-create-user-button').click();

  // Dialog stays open and we must not have navigated.
  await expect(dialog).toBeVisible();
  await expect(page).not.toHaveURL(/\/admin\/users\/\d+$/);

  // The bogus email is definitely not present in the DB — a targeted check
  // on a specific row, not a global count, so it's safe to run in parallel.
  const bogus = await prisma.user.findFirst({
    where: { email: 'not-an-email' },
  });
  expect(bogus).toBeNull();
});

// ─── Cancel button closes dialog without creating ───────────────────────────

test('[ADMIN][CREATE_USER]: clicking Cancel closes the dialog and does not create a user', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: '/admin/users',
  });

  const newUserEmail = seedTestEmail();

  await page.getByRole('button', { name: 'Create User' }).first().click();

  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();

  // Fill in valid data but cancel anyway.
  await dialog.getByLabel('Email').fill(newUserEmail);
  await dialog.getByLabel('Name').fill('Cancelled User');

  await dialog.getByRole('button', { name: 'Cancel' }).click();

  await expect(dialog).not.toBeVisible();

  // No user was created with that email.
  const created = await prisma.user.findUnique({
    where: { email: newUserEmail.toLowerCase() },
  });
  expect(created).toBeNull();
});

// ─── Email is lowercased when stored ─────────────────────────────────────────

test('[ADMIN][CREATE_USER]: email entered with mixed case is normalised to lowercase', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  // Build a known mixed-case email.
  const rawEmail = seedTestEmail();
  const mixedCaseEmail = rawEmail.replace(/^./, (c) => c.toUpperCase());

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: '/admin/users',
  });

  await submitCreateUserDialog({
    page,
    email: mixedCaseEmail,
    name: 'Mixed Case Email User',
  });

  await expect(page).toHaveURL(/\/admin\/users\/\d+$/, { timeout: 10_000 });

  // Look up by lowercased form — that's the canonical storage.
  const created = await prisma.user.findUnique({
    where: { email: rawEmail.toLowerCase() },
    select: { id: true, email: true, emailVerified: true },
  });

  expect(created).not.toBeNull();
  expect(created?.email).toBe(rawEmail.toLowerCase());
  // Verified — admin vouches for the email. Case normalisation must not
  // affect verification state.
  expect(created?.emailVerified).not.toBeNull();
});

// ─── Access control: non-admin cannot see the Create User affordance ────────

test('[ADMIN][CREATE_USER]: non-admin user redirected away from /admin/users and cannot see Create User button', async ({
  page,
}) => {
  const { user: nonAdminUser } = await seedUser({ isAdmin: false });

  await apiSignin({
    page,
    email: nonAdminUser.email,
    redirectPath: '/admin/users',
  });

  // Non-admins are redirected away from /admin/*; the admin heading must not
  // be visible.
  await expect(page.getByRole('heading', { name: 'Manage users' })).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Create User' })).not.toBeVisible();
});

test('[ADMIN][CREATE_USER]: unauthenticated user cannot access /admin/users', async ({ page }) => {
  // No apiSignin — just navigate directly.
  await page.goto('/admin/users');

  await expect(page).not.toHaveURL(/\/admin\/users$/);
  await expect(page.getByRole('button', { name: 'Create User' })).not.toBeVisible();
});
