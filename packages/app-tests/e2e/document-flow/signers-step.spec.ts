import { expect, test } from '@playwright/test';

import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUserSubscription } from '@documenso/prisma/seed/subscriptions';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test.describe('[EE_ONLY]', () => {
  const enterprisePriceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PLAN_MONTHLY_PRICE_ID || '';

  test.beforeEach(() => {
    test.skip(
      process.env.NEXT_PUBLIC_FEATURE_BILLING_ENABLED !== 'true' || !enterprisePriceId,
      'Billing required for this test',
    );
  });

  test('[DOCUMENT_FLOW] add EE settings', async ({ page }) => {
    const user = await seedUser();

    await seedUserSubscription({
      userId: user.id,
      priceId: enterprisePriceId,
    });

    const document = await seedBlankDocument(user);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/documents/${document.id}/edit`,
    });

    // Save the settings by going to the next step.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

    // Add 2 signers.
    await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
    await page.getByPlaceholder('Name').fill('Recipient 1');

    await page.getByRole('button', { name: 'Add Signer' }).click();
    await page.getByLabel('Email').nth(1).fill('recipient2@documenso.com');
    await page.getByLabel('Name').nth(1).fill('Recipient 2');

    // Display advanced settings.
    await page.getByLabel('Show advanced settings').check();

    // Navigate to the next step and back.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();
    await page.getByRole('button', { name: 'Go Back' }).click();
    await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

    // Todo: Fix stepper component back issue before finishing test.
  });
});

test('[DOCUMENT_FLOW]: add signers', async ({ page }) => {
  const user = await seedUser();
  const document = await seedBlankDocument(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/documents/${document.id}/edit`,
  });

  // Save the settings by going to the next step.
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

  // Navigate to the next step and back.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();
  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();
});

test('[DOCUMENT_FLOW]: add only recipients with the same email address', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();
});

test('[DOCUMENT_FLOW]: duplicate email recipients', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();
});

test('[DOCUMENT_FLOW]: same email with different roles', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();
});

test('[DOCUMENT_FLOW]: mixed unique and duplicate recipients', async ({ page }) => {
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

  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();
});
