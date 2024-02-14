import { expect, test } from '@playwright/test';

import { TEST_USERS } from '@documenso/prisma/seed/pr-711-deletion-of-documents';

import { manualLogin, manualSignout } from './fixtures/authentication';

test.describe.configure({ mode: 'serial' });

test('[PR-711]: seeded documents should be visible', async ({ page }) => {
  const [sender, ...recipients] = TEST_USERS;

  await page.goto('/signin');

  await page.getByLabel('Email').fill(sender.email);
  await page.getByLabel('Password', { exact: true }).fill(sender.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('/documents');

  await expect(page.getByRole('link', { name: 'Document 1 - Completed' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Document 1 - Pending' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Document 1 - Draft' })).toBeVisible();

  await manualSignout({ page });

  for (const recipient of recipients) {
    await page.waitForURL('/signin');
    await manualLogin({ page, email: recipient.email, password: recipient.password });

    await page.waitForURL('/documents');

    await expect(page.getByRole('link', { name: 'Document 1 - Completed' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Document 1 - Pending' })).toBeVisible();

    await expect(page.getByRole('link', { name: 'Document 1 - Draft' })).not.toBeVisible();

    await manualSignout({ page });
  }
});

test('[PR-711]: deleting a completed document should not remove it from recipients', async ({
  page,
}) => {
  const [sender, ...recipients] = TEST_USERS;

  await page.goto('/signin');

  // sign in
  await page.getByLabel('Email').fill(sender.email);
  await page.getByLabel('Password', { exact: true }).fill(sender.password);
  await page.getByRole('button', { name: 'Sign In' }).click();

  await page.waitForURL('/documents');

  // open actions menu
  await page
    .locator('tr', { hasText: 'Document 1 - Completed' })
    .getByRole('cell', { name: 'Download' })
    .getByRole('button')
    .nth(1)
    .click();

  // delete document
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('row', { name: /Document 1 - Completed/ })).not.toBeVisible();

  await manualSignout({ page });

  for (const recipient of recipients) {
    await page.waitForURL('/signin');
    await page.goto('/signin');

    // sign in
    await page.getByLabel('Email').fill(recipient.email);
    await page.getByLabel('Password', { exact: true }).fill(recipient.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    await page.waitForURL('/documents');

    await expect(page.getByRole('link', { name: 'Document 1 - Completed' })).toBeVisible();

    await page.goto(`/sign/completed-token-${recipients.indexOf(recipient)}`);
    await expect(page.getByText('Everyone has signed').nth(0)).toBeVisible();

    await page.goto('/documents');
    await manualSignout({ page });
  }
});

test('[PR-711]: deleting a pending document should remove it from recipients', async ({ page }) => {
  const [sender, ...recipients] = TEST_USERS;

  for (const recipient of recipients) {
    await page.goto(`/sign/pending-token-${recipients.indexOf(recipient)}`);

    await expect(page.getByText('Waiting for others to sign').nth(0)).toBeVisible();
  }

  await page.goto('/signin');

  await manualLogin({ page, email: sender.email, password: sender.password });
  await page.waitForURL('/documents');

  // open actions menu
  await page.locator('tr', { hasText: 'Document 1 - Pending' }).getByRole('button').nth(1).click();

  // delete document
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await page.getByPlaceholder("Type 'delete' to confirm").fill('delete');
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('row', { name: /Document 1 - Pending/ })).not.toBeVisible();

  // signout
  await manualSignout({ page });

  for (const recipient of recipients) {
    await page.waitForURL('/signin');

    await manualLogin({ page, email: recipient.email, password: recipient.password });
    await page.waitForURL('/documents');

    await expect(page.getByRole('link', { name: 'Document 1 - Pending' })).not.toBeVisible();

    await page.goto(`/sign/pending-token-${recipients.indexOf(recipient)}`);
    await expect(page.getByText(/document.*cancelled/i).nth(0)).toBeVisible();

    await page.goto('/documents');
    await page.waitForURL('/documents');

    await manualSignout({ page });
  }
});

test('[PR-711]: deleting a draft document should remove it without additional prompting', async ({
  page,
}) => {
  const [sender] = TEST_USERS;

  await manualLogin({ page, email: sender.email, password: sender.password });
  await page.waitForURL('/documents');

  // open actions menu
  await page
    .locator('tr', { hasText: 'Document 1 - Draft' })
    .getByRole('cell', { name: 'Edit' })
    .getByRole('button')
    .click();

  // delete document
  await page.getByRole('menuitem', { name: 'Delete' }).click();
  await expect(page.getByPlaceholder("Type 'delete' to confirm")).not.toBeVisible();
  await page.getByRole('button', { name: 'Delete' }).click();

  await expect(page.getByRole('row', { name: /Document 1 - Draft/ })).not.toBeVisible();
});
