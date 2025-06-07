import { expect, test } from '@playwright/test';

import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

// test.describe('[EE_ONLY]', () => {
//   // eslint-disable-next-line turbo/no-undeclared-env-vars
//   const enterprisePriceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PLAN_MONTHLY_PRICE_ID || '';

//   test.beforeEach(() => {
//     test.skip(
//       process.env.NEXT_PUBLIC_FEATURE_BILLING_ENABLED !== 'true' || !enterprisePriceId,
//       'Billing required for this test',
//     );
//   });

//   test('[TEMPLATE_FLOW] add EE settings', async ({ page }) => {
//     const user = await seedUser();

//     await seedUserSubscription({
//       userId: user.id,
//       priceId: enterprisePriceId,
//     });

//     const template = await seedBlankTemplate(user);

//     await apiSignin({
//       page,
//       email: user.email,
//       redirectPath: `/templates/${template.id}/edit`,
//     });

//     // Save the settings by going to the next step.
//     await page.getByRole('button', { name: 'Continue' }).click();
//     await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

//     // Add 2 signers.
//     await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
//     await page.getByPlaceholder('Name').fill('Recipient 1');
//     await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();
//     await page.getByPlaceholder('Email').nth(1).fill('recipient2@documenso.com');
//     await page.getByPlaceholder('Name').nth(1).fill('Recipient 2');

//     // Display advanced settings.
//     await page.getByLabel('Show advanced settings').check();

//     // Navigate to the next step and back.
//     await page.getByRole('button', { name: 'Continue' }).click();
//     await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();
//     await page.getByRole('button', { name: 'Go Back' }).click();
//     await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

//     // Expect that the advanced settings is unchecked, since no advanced settings were applied.
//     await expect(page.getByLabel('Show advanced settings')).toBeChecked({ checked: false });

//     // Add advanced settings for a single recipient.
//     await page.getByLabel('Show advanced settings').check();
//     await page.getByRole('combobox').first().click();
//     await page.getByLabel('Require passkey').click();

//     // Navigate to the next step and back.
//     await page.getByRole('button', { name: 'Continue' }).click();
//     await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();
//     await page.getByRole('button', { name: 'Go Back' }).click();
//     await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

//     // Expect that the advanced settings is visible, and the checkbox is hidden. Since advanced
//     // settings were applied.
//     await expect(page.getByLabel('Show advanced settings')).toBeHidden();
//   });
// });

test('[TEMPLATE_FLOW]: add placeholder', async ({ page }) => {
  const { user, team } = await seedUser();
  const template = await seedBlankTemplate(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
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
