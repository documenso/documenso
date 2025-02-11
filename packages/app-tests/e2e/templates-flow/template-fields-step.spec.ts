import { expect, test } from '@playwright/test';

import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[TEMPLATE_FLOW]: add signature fields for unique recipients', async ({ page }) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholders' })).toBeVisible();

  // Add 2 placeholder recipients.
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');

  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  await page.getByPlaceholder('Email').nth(1).fill('recipient2@documenso.com');
  await page.getByPlaceholder('Name').nth(1).fill('Recipient 2');

  // Advanced settings should not be visible for non EE users.
  await expect(page.getByLabel('Show advanced settings')).toBeHidden();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 100,
    },
  });

  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Recipient 2 (recipient2@documenso.com)' }).click();

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 200,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Save Template' }).click();

  await page.waitForURL('**/templates');

  await expect(page.getByRole('link', { name: template.title })).toBeVisible();
});

test('[TEMPLATE_FLOW]: add signature fields for duplicate recipients', async ({ page }) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholders' })).toBeVisible();

  await page.getByPlaceholder('Email').fill('recipient@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient');

  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  await page.getByPlaceholder('Email').nth(1).fill('recipient@documenso.com');
  await page.getByPlaceholder('Name').nth(1).fill('Recipient');

  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  await page.getByPlaceholder('Email').nth(2).fill('recipient@documenso.com');
  await page.getByPlaceholder('Name').nth(2).fill('Recipient');

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  // Add signature fields for each recipient
  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 100,
    },
  });

  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Recipient (recipient@documenso.com)' }).nth(1).click();

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 200,
      y: 100,
    },
  });

  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Recipient (recipient@documenso.com)' }).nth(2).click();

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 300,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Save Template' }).click();

  await page.waitForURL('**/templates');

  await expect(page.getByRole('link', { name: template.title })).toBeVisible();
});

test('[TEMPLATE_FLOW]: add signature fields for recipients with different roles', async ({
  page,
}) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholders' })).toBeVisible();

  // Add a placeholder recipient
  await page.getByPlaceholder('Email').fill('recipient@documenso.com');
  await page.getByPlaceholder('Name').fill('Documenso Recipient');
  await page.getByRole('combobox').click();
  await page.getByLabel('Needs to sign').click();
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  // Add an approver
  await page.getByPlaceholder('Email').nth(1).fill('recipient@documenso.com');
  await page.getByPlaceholder('Name').nth(1).fill('Documenso Recipient');
  await page.getByRole('combobox').nth(1).click();
  await page.getByLabel('Needs to approve').click();
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  // Add a viewer
  await page.getByPlaceholder('Email').nth(2).fill('recipient@documenso.com');
  await page.getByPlaceholder('Name').nth(2).fill('Documenso Recipient');
  await page.getByRole('combobox').nth(2).click();
  await page.getByLabel('Needs to view').click();
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  // Add a CC
  await page.getByPlaceholder('Email').nth(3).fill('recipient@documenso.com');
  await page.getByPlaceholder('Name').nth(3).fill('Documenso Recipient');
  await page.getByRole('combobox').nth(3).click();
  await page.getByLabel('Receives copy').click();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  // Add signature fields for signer and approver
  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 100,
    },
  });

  await page.getByRole('combobox').click();
  await page
    .getByRole('option', { name: 'Documenso Recipient (recipient@documenso.com)' })
    .nth(1)
    .click();

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 200,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Save Template' }).click();

  await page.waitForURL('**/templates');

  await expect(page.getByRole('link', { name: template.title })).toBeVisible();
});

test('[TEMPLATE_FLOW]: add signature fields for mixed recipients', async ({ page }) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholders' })).toBeVisible();

  // First placeholder recipient (unique)
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('First Recipient');
  await page.getByRole('combobox').click();
  await page.getByLabel('Needs to approve').click();
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  // Second placeholder recipient (duplicate of first)
  await page.getByPlaceholder('Email').nth(1).fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').nth(1).fill('First Recipient');
  await page.getByRole('combobox').nth(1).click();
  await page.getByLabel('Needs to view').click();
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  // Third placeholder recipient (unique)
  await page.getByPlaceholder('Email').nth(2).fill('recipient2@documenso.com');
  await page.getByPlaceholder('Name').nth(2).fill('Second Recipient');
  await page.getByRole('combobox').nth(2).click();
  await page.getByLabel('Needs to sign').click();
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  // Fourth placeholder recipient (duplicate of first)
  await page.getByPlaceholder('Email').nth(3).fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').nth(3).fill('First Recipient');
  await page.getByRole('combobox').nth(3).click();
  await page.getByLabel('Receives copy').click();
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  // Fifth placeholder recipient (unique)
  await page.getByPlaceholder('Email').nth(4).fill('recipient3@documenso.com');
  await page.getByPlaceholder('Name').nth(4).fill('Third Recipient');
  await page.getByRole('combobox').nth(4).click();
  await page.getByLabel('Needs to sign').click();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  // Add signature fields for approver and signers
  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 100,
      y: 100,
    },
  });

  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Second Recipient (recipient2@documenso.com)' }).click();

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 200,
      y: 100,
    },
  });

  await page.getByRole('combobox').click();
  await page.getByRole('option', { name: 'Third Recipient (recipient3@documenso.com)' }).click();

  await page.getByRole('button', { name: 'Signature' }).click();
  await page.locator('canvas').click({
    position: {
      x: 300,
      y: 100,
    },
  });

  await page.getByRole('button', { name: 'Save Template' }).click();

  await page.waitForURL('**/templates');

  await expect(page.getByRole('link', { name: template.title })).toBeVisible();
});
