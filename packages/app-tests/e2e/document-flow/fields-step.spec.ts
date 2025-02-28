import { expect, test } from '@playwright/test';

import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[DOCUMENT_FLOW]: add signature fields for unique recipients', async ({ page }) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  // Add 2 signers.
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');

  await page.getByRole('button', { name: 'Add Signer' }).click();

  await page.getByLabel('Email').nth(1).fill('recipient2@documenso.com');
  await page.getByLabel('Name').nth(1).fill('Recipient 2');

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

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();

  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL('**/documents');

  await expect(page.getByRole('link', { name: document.title })).toBeVisible();
});

test('[DOCUMENT_FLOW]: add signature fields for duplicate recipients', async ({ page }) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  await page.getByPlaceholder('Email').fill('recipient@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient');

  await page.getByRole('button', { name: 'Add Signer' }).click();

  await page.getByLabel('Email').nth(1).fill('recipient@documenso.com');
  await page.getByLabel('Name').nth(1).fill('Recipient');

  await page.getByRole('button', { name: 'Add Signer' }).click();

  await page.getByLabel('Email').nth(2).fill('recipient@documenso.com');
  await page.getByLabel('Name').nth(2).fill('Recipient');

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

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();

  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL('**/documents');

  await expect(page.getByRole('link', { name: document.title })).toBeVisible();
});

test('[DOCUMENT_FLOW]: add signature fields for recipients with different roles', async ({
  page,
}) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  // Add a signer
  await page.getByPlaceholder('Email').fill('recipient@documenso.com');
  await page.getByPlaceholder('Name').fill('Documenso Recipient');
  await page.getByRole('combobox').click();
  await page.getByLabel('Needs to sign').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  // Add an approver
  await page.getByLabel('Email').nth(1).fill('recipient@documenso.com');
  await page.getByLabel('Name').nth(1).fill('Documenso Recipient');
  await page.getByRole('combobox').nth(1).click();
  await page.getByLabel('Needs to approve').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  // Add a viewer
  await page.getByLabel('Email').nth(2).fill('recipient@documenso.com');
  await page.getByLabel('Name').nth(2).fill('Documenso Recipient');
  await page.getByRole('combobox').nth(2).click();
  await page.getByLabel('Needs to view').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  // Add a CC
  await page.getByLabel('Email').nth(3).fill('recipient@documenso.com');
  await page.getByLabel('Name').nth(3).fill('Documenso Recipient');
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

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();

  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL('**/documents');

  await expect(page.getByRole('link', { name: document.title })).toBeVisible();
});

test('[DOCUMENT_FLOW]: add signature fields for mixed recipients', async ({ page }) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  // First recipient (unique)
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('First Recipient');
  await page.getByRole('combobox').click();
  await page.getByLabel('Needs to approve').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  // Second recipient (duplicate of first)
  await page.getByLabel('Email').nth(1).fill('recipient1@documenso.com');
  await page.getByLabel('Name').nth(1).fill('First Recipient');
  await page.getByRole('combobox').nth(1).click();
  await page.getByLabel('Needs to view').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  // Third recipient (unique)
  await page.getByLabel('Email').nth(2).fill('recipient2@documenso.com');
  await page.getByLabel('Name').nth(2).fill('Second Recipient');
  await page.getByRole('combobox').nth(2).click();
  await page.getByLabel('Needs to sign').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  // Fourth recipient (duplicate of first)
  await page.getByLabel('Email').nth(3).fill('recipient1@documenso.com');
  await page.getByLabel('Name').nth(3).fill('First Recipient');
  await page.getByRole('combobox').nth(3).click();
  await page.getByLabel('Receives copy').click();
  await page.getByRole('button', { name: 'Add Signer' }).click();

  // Fifth recipient (unique)
  await page.getByLabel('Email').nth(4).fill('recipient3@documenso.com');
  await page.getByLabel('Name').nth(4).fill('Third Recipient');
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

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Distribute Document' })).toBeVisible();

  await page.getByRole('button', { name: 'Send' }).click();

  await page.waitForURL('**/documents');

  await expect(page.getByRole('link', { name: document.title })).toBeVisible();
});
