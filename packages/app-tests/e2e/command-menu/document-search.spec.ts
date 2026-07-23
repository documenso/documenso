import { seedPendingDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { apiSignin } from '../fixtures/authentication';
import { openCommandMenu } from '../fixtures/command-menu';

const COMMAND_MENU_PLACEHOLDER = 'Type a command or search...';

test('[COMMAND_MENU]: should see sent documents', async ({ page }) => {
  const { user, team } = await seedUser();
  const { user: recipient } = await seedUser();
  const document = await seedPendingDocument(user, team.id, [recipient]);

  await apiSignin({
    page,
    email: user.email,
  });

  await openCommandMenu(page, COMMAND_MENU_PLACEHOLDER);

  await page.getByPlaceholder(COMMAND_MENU_PLACEHOLDER).first().fill(document.title);
  await expect(page.getByRole('option', { name: document.title })).toBeVisible();
});

test('[COMMAND_MENU]: should see received documents', async ({ page }) => {
  const { user, team } = await seedUser();
  const { user: recipient } = await seedUser();
  const document = await seedPendingDocument(user, team.id, [recipient]);

  await apiSignin({
    page,
    email: recipient.email,
  });

  await openCommandMenu(page, COMMAND_MENU_PLACEHOLDER);

  await page.getByPlaceholder(COMMAND_MENU_PLACEHOLDER).first().fill(document.title);
  await expect(page.getByRole('option', { name: document.title })).toBeVisible();
});

test('[COMMAND_MENU]: should be able to search by recipient', async ({ page }) => {
  const { user, team } = await seedUser();
  const { user: recipient } = await seedUser();
  const document = await seedPendingDocument(user, team.id, [recipient]);

  await apiSignin({
    page,
    email: user.email,
  });

  await openCommandMenu(page, COMMAND_MENU_PLACEHOLDER);

  await page.getByPlaceholder(COMMAND_MENU_PLACEHOLDER).first().fill(recipient.email);
  await expect(page.getByRole('option', { name: document.title })).toBeVisible();
});
