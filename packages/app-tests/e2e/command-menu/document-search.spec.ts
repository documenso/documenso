import { expect, test } from '@playwright/test';

import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test('[COMMAND_MENU]: should see sent documents', async ({ page }) => {
  const user = await seedUser();
  const recipient = await seedUser();
  const document = await seedPendingDocument(user, [recipient]);

  await apiSignin({
    page,
    email: user.email,
  });

  await page.keyboard.press('Meta+K');

  await page.getByPlaceholder('Type a command or search...').first().fill(document.title);
  await expect(page.getByRole('option', { name: document.title })).toBeVisible();
});

test('[COMMAND_MENU]: should see received documents', async ({ page }) => {
  const user = await seedUser();
  const recipient = await seedUser();
  const document = await seedPendingDocument(user, [recipient]);

  await apiSignin({
    page,
    email: recipient.email,
  });

  await page.keyboard.press('Meta+K');

  await page.getByPlaceholder('Type a command or search...').first().fill(document.title);
  await expect(page.getByRole('option', { name: document.title })).toBeVisible();
});

test('[COMMAND_MENU]: should be able to search by recipient', async ({ page }) => {
  const user = await seedUser();
  const recipient = await seedUser();
  const document = await seedPendingDocument(user, [recipient]);

  await apiSignin({
    page,
    email: recipient.email,
  });

  await page.keyboard.press('Meta+K');

  await page.getByPlaceholder('Type a command or search...').first().fill(recipient.email);
  await expect(page.getByRole('option', { name: document.title })).toBeVisible();
});
