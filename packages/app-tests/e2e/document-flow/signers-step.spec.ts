import { expect, test } from '@playwright/test';

import { seedBlankDocument } from '@documenso/prisma/seed/documents';
import { seedUserSubscription } from '@documenso/prisma/seed/subscriptions';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe('[EE_ONLY]', () => {
  // eslint-disable-next-line turbo/no-undeclared-env-vars
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
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
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
