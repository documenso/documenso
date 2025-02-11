import { expect, test } from '@playwright/test';

import { seedUserSubscription } from '@documenso/prisma/seed/subscriptions';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
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

  test('[TEMPLATE_FLOW] add EE settings', async ({ page }) => {
    const user = await seedUser();

    await seedUserSubscription({
      userId: user.id,
      priceId: enterprisePriceId,
    });

    const template = await seedBlankTemplate(user);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/templates/${template.id}/edit`,
    });

    // Save the settings by going to the next step.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

    // Add 2 signers.
    await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
    await page.getByPlaceholder('Name').fill('Recipient 1');
    await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();
    await page.getByPlaceholder('Email').nth(1).fill('recipient2@documenso.com');
    await page.getByPlaceholder('Name').nth(1).fill('Recipient 2');

    // Display advanced settings.
    await page.getByLabel('Show advanced settings').check();

    // Navigate to the next step and back.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();
    await page.getByRole('button', { name: 'Go Back' }).click();
    await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

    // Expect that the advanced settings is unchecked, since no advanced settings were applied.
    await expect(page.getByLabel('Show advanced settings')).toBeChecked({ checked: false });

    // Add advanced settings for a single recipient.
    await page.getByLabel('Show advanced settings').check();
    await page.getByRole('combobox').first().click();
    await page.getByLabel('Require passkey').click();

    // Navigate to the next step and back.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();
    await page.getByRole('button', { name: 'Go Back' }).click();
    await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

    // Expect that the advanced settings is visible, and the checkbox is hidden. Since advanced
    // settings were applied.
    await expect(page.getByLabel('Show advanced settings')).toBeHidden();
  });
});

test('[TEMPLATE_FLOW]: add placeholder', async ({ page }) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}/edit`,
  });

  // Save the settings by going to the next step.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

  // Add 2 signers.
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();
  await page.getByPlaceholder('Email').nth(1).fill('recipient2@documenso.com');
  await page.getByPlaceholder('Name').nth(1).fill('Recipient 2');

  // Advanced settings should not be visible for non EE users.
  await expect(page.getByLabel('Show advanced settings')).toBeHidden();
});

test('[TEMPLATE_FLOW]: duplicate recipients', async ({ page }) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

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

  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();
});

test('[TEMPLATE_FLOW]: same email different roles', async ({ page }) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

  // Add a signer
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

  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();
});

test('[TEMPLATE_FLOW]: mixed recipients', async ({ page }) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}/edit`,
  });

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

  // First recipient (unique)
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('First Recipient');
  await page.getByRole('combobox').click();
  await page.getByLabel('Needs to approve').click();
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  // Second recipient (duplicate of first)
  await page.getByPlaceholder('Email').nth(1).fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').nth(1).fill('First Recipient');
  await page.getByRole('combobox').nth(1).click();
  await page.getByLabel('Needs to view').click();
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  // Third recipient (unique)
  await page.getByPlaceholder('Email').nth(2).fill('recipient2@documenso.com');
  await page.getByPlaceholder('Name').nth(2).fill('Second Recipient');
  await page.getByRole('combobox').nth(2).click();
  await page.getByLabel('Needs to sign').click();
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  // Fourth recipient (duplicate of first)
  await page.getByPlaceholder('Email').nth(3).fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').nth(3).fill('First Recipient');
  await page.getByRole('combobox').nth(3).click();
  await page.getByLabel('Receives copy').click();
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();

  // Fifth recipient (unique)
  await page.getByPlaceholder('Email').nth(4).fill('recipient3@documenso.com');
  await page.getByPlaceholder('Name').nth(4).fill('Third Recipient');
  await page.getByRole('combobox').nth(4).click();
  await page.getByLabel('Needs to sign').click();

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();
});
