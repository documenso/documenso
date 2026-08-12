import { decryptEmailTransportConfig } from '@documenso/lib/server-only/email/email-transport-config';
import { nanoid } from '@documenso/lib/universal/id';
import { prisma } from '@documenso/prisma';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, type Locator, type Page, test } from '@playwright/test';

import { apiSignin } from '../../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

// ─── Cleanup ─────────────────────────────────────────────────────────────────

// Transport names created by the current test, deleted afterwards so the global
// email-transports table doesn't accumulate rows across runs.
const transportNamesToCleanup: string[] = [];

const trackTransport = (name: string) => {
  transportNamesToCleanup.push(name);
  return name;
};

test.afterEach(async () => {
  if (transportNamesToCleanup.length > 0) {
    await prisma.emailTransport.deleteMany({ where: { name: { in: transportNamesToCleanup } } });
    transportNamesToCleanup.length = 0;
  }
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const getTransportFromDbOrThrow = async (name: string) => {
  await expect
    .poll(async () => prisma.emailTransport.findFirst({ where: { name }, select: { id: true } }), {
      message: `transport "${name}" was not persisted in time`,
      timeout: 10_000,
      intervals: [200, 400, 800],
    })
    .not.toBeNull();

  return prisma.emailTransport.findFirstOrThrow({ where: { name } });
};

const openCreateDialog = async (page: Page) => {
  await page.getByRole('button', { name: 'Add transport' }).click();

  const dialog = page.getByRole('dialog');
  await expect(dialog.getByRole('heading', { name: 'Add Email Transport' })).toBeVisible();

  return dialog;
};

const selectTransportType = async (page: Page, dialog: Locator, optionName: string) => {
  // The transport-type Select is the only combobox inside the create/edit dialog.
  await dialog.getByRole('combobox').click();
  await page.getByRole('option', { name: optionName, exact: true }).click();
};

const searchForTransport = async (page: Page, name: string) => {
  // The row-level Edit/Delete dialogs live inside the table row. Wait for the
  // debounced search refetch to land before interacting, otherwise a late
  // re-render can unmount a freshly-opened dialog.
  const searchSettled = page
    .waitForResponse((r) => r.url().includes('emailTransport.find') && r.url().includes(name), { timeout: 15_000 })
    .catch(() => undefined);

  await page.getByPlaceholder('Search by name or from address').fill(name);
  await searchSettled;

  await expect(page.getByRole('row', { name })).toBeVisible();
};

const openRowAction = async (page: Page, name: string, action: 'Edit' | 'Send test' | 'Delete') => {
  await searchForTransport(page, name);
  // The transports table row has exactly one button: the actions dropdown trigger.
  await page.getByRole('row', { name }).getByRole('button').click();
  await page.getByRole('menuitem', { name: action }).click();
};

// ─── Create: RESEND (round-trips the secret through encrypt/decrypt) ─────────

test('[ADMIN][EMAIL_TRANSPORT]: create a RESEND transport encrypts the secret and round-trips correctly', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const name = trackTransport(`e2e-resend-${nanoid()}`);
  const apiKey = `re_${nanoid()}`;

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/email-transports' });

  const dialog = await openCreateDialog(page);

  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByLabel('From name', { exact: true }).fill('Acme Mailer');
  await dialog.getByLabel('From address', { exact: true }).fill('sender@example.com');
  await selectTransportType(page, dialog, 'Resend');
  await dialog.getByLabel('API key', { exact: true }).fill(apiKey);

  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  const row = await getTransportFromDbOrThrow(name);

  // The stored blob must NOT contain the plaintext secret.
  expect(row.config).not.toContain(apiKey);
  expect(row.type).toBe('RESEND');
  expect(row.fromName).toBe('Acme Mailer');
  expect(row.fromAddress).toBe('sender@example.com');

  // Decrypting yields the original config (proves encrypt → store → decrypt works).
  const config = decryptEmailTransportConfig(row.config);
  expect(config).toEqual({ type: 'RESEND', apiKey });
});

// ─── Create: SMTP_AUTH (non-secret + secret fields) ─────────────────────────

test('[ADMIN][EMAIL_TRANSPORT]: create an SMTP_AUTH transport stores host/port/username and encrypts the password', async ({
  page,
}) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const name = trackTransport(`e2e-smtp-${nanoid()}`);
  const password = `pw_${nanoid()}`;

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/email-transports' });

  const dialog = await openCreateDialog(page);

  await dialog.getByLabel('Name', { exact: true }).fill(name);
  await dialog.getByLabel('From name', { exact: true }).fill('SMTP Sender');
  await dialog.getByLabel('From address', { exact: true }).fill('smtp-sender@example.com');
  // Default type is SMTP_AUTH, so the host/port/username/password fields are already shown.
  await dialog.getByLabel('Host', { exact: true }).fill('smtp.example.com');
  await dialog.getByLabel('Port', { exact: true }).fill('587');
  await dialog.getByLabel('Username', { exact: true }).fill('smtp-user');
  await dialog.getByLabel('Password', { exact: true }).fill(password);

  await dialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(dialog).not.toBeVisible();

  const row = await getTransportFromDbOrThrow(name);

  expect(row.config).not.toContain(password);

  const config = decryptEmailTransportConfig(row.config);
  expect(config).toEqual({
    type: 'SMTP_AUTH',
    host: 'smtp.example.com',
    port: 587,
    secure: false,
    ignoreTLS: false,
    username: 'smtp-user',
    password,
  });
});

// ─── Update without a secret preserves the existing secret ───────────────────

test('[ADMIN][EMAIL_TRANSPORT]: updating without a secret keeps the existing secret intact', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const name = trackTransport(`e2e-keep-${nanoid()}`);
  const originalApiKey = `re_keep_${nanoid()}`;

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/email-transports' });

  // Create the transport with a secret.
  const createDialog = await openCreateDialog(page);
  await createDialog.getByLabel('Name', { exact: true }).fill(name);
  await createDialog.getByLabel('From name', { exact: true }).fill('Keep Original');
  await createDialog.getByLabel('From address', { exact: true }).fill('keep@example.com');
  await selectTransportType(page, createDialog, 'Resend');
  await createDialog.getByLabel('API key', { exact: true }).fill(originalApiKey);
  await createDialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(createDialog).not.toBeVisible();

  await getTransportFromDbOrThrow(name);

  // Edit: change a non-secret field, leave the API key blank.
  await openRowAction(page, name, 'Edit');

  const editDialog = page.getByRole('dialog');
  await expect(editDialog.getByRole('heading', { name: 'Edit Email Transport' })).toBeVisible();

  // The secret field stays blank (we never re-enter it).
  await expect(editDialog.getByLabel('API key', { exact: true })).toHaveValue('');
  await editDialog.getByLabel('From name', { exact: true }).fill('Renamed Sender');
  await editDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(editDialog).not.toBeVisible();

  // The update ran (fromName changed) but the original secret is preserved.
  await expect
    .poll(async () => {
      const row = await prisma.emailTransport.findFirstOrThrow({ where: { name } });
      return row.fromName;
    })
    .toBe('Renamed Sender');

  const row = await prisma.emailTransport.findFirstOrThrow({ where: { name } });
  const config = decryptEmailTransportConfig(row.config);
  expect(config).toEqual({ type: 'RESEND', apiKey: originalApiKey });
});

// ─── Update with a new secret correctly replaces it ──────────────────────────

test('[ADMIN][EMAIL_TRANSPORT]: updating with a new secret replaces the stored secret', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const name = trackTransport(`e2e-replace-${nanoid()}`);
  const originalApiKey = `re_old_${nanoid()}`;
  const newApiKey = `re_new_${nanoid()}`;

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/email-transports' });

  const createDialog = await openCreateDialog(page);
  await createDialog.getByLabel('Name', { exact: true }).fill(name);
  await createDialog.getByLabel('From name', { exact: true }).fill('Replace Secret');
  await createDialog.getByLabel('From address', { exact: true }).fill('replace@example.com');
  await selectTransportType(page, createDialog, 'Resend');
  await createDialog.getByLabel('API key', { exact: true }).fill(originalApiKey);
  await createDialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(createDialog).not.toBeVisible();

  await getTransportFromDbOrThrow(name);

  await openRowAction(page, name, 'Edit');

  const editDialog = page.getByRole('dialog');
  await editDialog.getByLabel('API key', { exact: true }).fill(newApiKey);
  await editDialog.getByRole('button', { name: 'Save changes' }).click();
  await expect(editDialog).not.toBeVisible();

  await expect
    .poll(async () => {
      const row = await prisma.emailTransport.findFirstOrThrow({ where: { name } });
      const config = decryptEmailTransportConfig(row.config);
      return config.type === 'RESEND' ? config.apiKey : null;
    })
    .toBe(newApiKey);

  // And it definitely no longer decrypts to the old secret.
  const row = await prisma.emailTransport.findFirstOrThrow({ where: { name } });
  expect(row.config).not.toContain(originalApiKey);
});

// ─── Delete ──────────────────────────────────────────────────────────────────

test('[ADMIN][EMAIL_TRANSPORT]: delete removes the transport', async ({ page }) => {
  const { user: adminUser } = await seedUser({ isAdmin: true });

  const name = trackTransport(`e2e-delete-${nanoid()}`);

  await apiSignin({ page, email: adminUser.email, redirectPath: '/admin/email-transports' });

  const createDialog = await openCreateDialog(page);
  await createDialog.getByLabel('Name', { exact: true }).fill(name);
  await createDialog.getByLabel('From name', { exact: true }).fill('To Delete');
  await createDialog.getByLabel('From address', { exact: true }).fill('delete@example.com');
  await selectTransportType(page, createDialog, 'Resend');
  await createDialog.getByLabel('API key', { exact: true }).fill(`re_${nanoid()}`);
  await createDialog.getByRole('button', { name: 'Create', exact: true }).click();
  await expect(createDialog).not.toBeVisible();

  const row = await getTransportFromDbOrThrow(name);

  await openRowAction(page, name, 'Delete');

  const deleteDialog = page.getByRole('dialog');
  await expect(deleteDialog.getByRole('heading', { name: 'Delete Email Transport' })).toBeVisible();
  await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
  await expect(deleteDialog).not.toBeVisible();

  await expect.poll(async () => prisma.emailTransport.findUnique({ where: { id: row.id } })).toBeNull();
});

// ─── Access control ──────────────────────────────────────────────────────────

test('[ADMIN][EMAIL_TRANSPORT]: a non-admin cannot access the email transports page', async ({ page }) => {
  const { user: nonAdminUser } = await seedUser({ isAdmin: false });

  await apiSignin({ page, email: nonAdminUser.email, redirectPath: '/admin/email-transports' });

  await expect(page.getByRole('button', { name: 'Add transport' })).not.toBeVisible();
});
