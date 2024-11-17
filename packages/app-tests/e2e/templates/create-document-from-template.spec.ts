import { expect, test } from '@playwright/test';

import { extractDocumentAuthMethods } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import { seedUserSubscription } from '@documenso/prisma/seed/subscriptions';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

const enterprisePriceId = process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PLAN_MONTHLY_PRICE_ID || '';

/**
 * 1. Create a template with all settings filled out
 * 2. Create a document from the template
 * 3. Ensure all values are correct
 *
 * Note: There is a direct copy paste of this test below for teams.
 *
 * If you update this test please update that test as well.
 */
test('[TEMPLATE]: should create a document from a template', async ({ page }) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  const isBillingEnabled =
    process.env.NEXT_PUBLIC_FEATURE_BILLING_ENABLED === 'true' && enterprisePriceId;

  await seedUserSubscription({
    userId: user.id,
    priceId: enterprisePriceId,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}/edit`,
  });

  // Set template title.
  await page.getByLabel('Title').fill('TEMPLATE_TITLE');

  // Set template document access.
  await page.getByTestId('documentAccessSelectValue').click();
  await page.getByLabel('Require account').getByText('Require account').click();
  await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');

  // Set EE action auth.
  if (isBillingEnabled) {
    await page.getByTestId('documentActionSelectValue').click();
    await page.getByLabel('Require passkey').getByText('Require passkey').click();
    await expect(page.getByTestId('documentActionSelectValue')).toContainText('Require passkey');
  }

  // Set email options.
  await page.getByRole('button', { name: 'Email Options' }).click();
  await page.getByLabel('Subject (Optional)').fill('SUBJECT');
  await page.getByLabel('Message (Optional)').fill('MESSAGE');

  // Set advanced options.
  await page.getByRole('button', { name: 'Advanced Options' }).click();
  await page.locator('button').filter({ hasText: 'YYYY-MM-DD HH:mm a' }).click();
  await page.getByLabel('DD/MM/YYYY').click();

  await page.locator('.time-zone-field').click();
  await page.getByRole('option', { name: 'Etc/UTC' }).click();
  await page.getByLabel('Redirect URL').fill('https://documenso.com');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

  // Add 2 signers.
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();
  await page.getByPlaceholder('Email').nth(1).fill('recipient2@documenso.com');
  await page.getByPlaceholder('Name').nth(1).fill('Recipient 2');

  // Apply require passkey for Recipient 1.
  if (isBillingEnabled) {
    await page.getByLabel('Show advanced settings').check();
    await page.getByRole('combobox').first().click();
    await page.getByLabel('Require passkey').click();
  }

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'Save template' }).click();

  // Use template
  await page.waitForURL('/templates');
  await page.getByRole('button', { name: 'Use Template' }).click();
  await page.getByRole('button', { name: 'Create as draft' }).click();

  // Review that the document was created with the correct values.
  await page.waitForURL(/documents/);

  const documentId = Number(page.url().split('/').pop());

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
    },
    include: {
      Recipient: true,
      documentMeta: true,
    },
  });

  const documentAuth = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
  });

  expect(document.title).toEqual('TEMPLATE_TITLE');
  expect(documentAuth.documentAuthOption.globalAccessAuth).toEqual('ACCOUNT');
  expect(documentAuth.documentAuthOption.globalActionAuth).toEqual(
    isBillingEnabled ? 'PASSKEY' : null,
  );
  expect(document.documentMeta?.dateFormat).toEqual('dd/MM/yyyy hh:mm a');
  expect(document.documentMeta?.message).toEqual('MESSAGE');
  expect(document.documentMeta?.redirectUrl).toEqual('https://documenso.com');
  expect(document.documentMeta?.subject).toEqual('SUBJECT');
  expect(document.documentMeta?.timezone).toEqual('Etc/UTC');

  const recipientOne = document.Recipient[0];
  const recipientTwo = document.Recipient[1];

  const recipientOneAuth = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
    recipientAuth: recipientOne.authOptions,
  });

  const recipientTwoAuth = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
    recipientAuth: recipientTwo.authOptions,
  });

  if (isBillingEnabled) {
    expect(recipientOneAuth.derivedRecipientActionAuth).toEqual('PASSKEY');
  }

  expect(recipientOneAuth.derivedRecipientAccessAuth).toEqual('ACCOUNT');
  expect(recipientTwoAuth.derivedRecipientAccessAuth).toEqual('ACCOUNT');
});

/**
 * This is a direct copy paste of the above test but for teams.
 */
test('[TEMPLATE]: should create a team document from a team template', async ({ page }) => {
  const { owner, ...team } = await seedTeam({
    createTeamMembers: 2,
  });

  const template = await seedBlankTemplate(owner, {
    createTemplateOptions: {
      teamId: team.id,
    },
  });

  const isBillingEnabled =
    process.env.NEXT_PUBLIC_FEATURE_BILLING_ENABLED === 'true' && enterprisePriceId;

  await seedUserSubscription({
    userId: owner.id,
    priceId: enterprisePriceId,
  });

  await apiSignin({
    page,
    email: owner.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
  });

  // Set template title.
  await page.getByLabel('Title').fill('TEMPLATE_TITLE');

  // Set template document access.
  await page.getByTestId('documentAccessSelectValue').click();
  await page.getByLabel('Require account').getByText('Require account').click();
  await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');

  // Set EE action auth.
  if (isBillingEnabled) {
    await page.getByTestId('documentActionSelectValue').click();
    await page.getByLabel('Require passkey').getByText('Require passkey').click();
    await expect(page.getByTestId('documentActionSelectValue')).toContainText('Require passkey');
  }

  // Set email options.
  await page.getByRole('button', { name: 'Email Options' }).click();
  await page.getByLabel('Subject (Optional)').fill('SUBJECT');
  await page.getByLabel('Message (Optional)').fill('MESSAGE');

  // Set advanced options.
  await page.getByRole('button', { name: 'Advanced Options' }).click();
  await page.locator('button').filter({ hasText: 'YYYY-MM-DD HH:mm a' }).click();
  await page.getByLabel('DD/MM/YYYY').click();

  await page.locator('.time-zone-field').click();
  await page.getByRole('option', { name: 'Etc/UTC' }).click();
  await page.getByLabel('Redirect URL').fill('https://documenso.com');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByRole('heading', { name: 'Add Placeholder' })).toBeVisible();

  // Add 2 signers.
  await page.getByPlaceholder('Email').fill('recipient1@documenso.com');
  await page.getByPlaceholder('Name').fill('Recipient 1');
  await page.getByRole('button', { name: 'Add Placeholder Recipient' }).click();
  await page.getByPlaceholder('Email').nth(1).fill('recipient2@documenso.com');
  await page.getByPlaceholder('Name').nth(1).fill('Recipient 2');

  // Apply require passkey for Recipient 1.
  if (isBillingEnabled) {
    await page.getByLabel('Show advanced settings').check();
    await page.getByRole('combobox').first().click();
    await page.getByLabel('Require passkey').click();
  }

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Fields' })).toBeVisible();

  await page.getByRole('button', { name: 'Save template' }).click();

  // Use template
  await page.waitForURL(`/t/${team.url}/templates`);
  await page.getByRole('button', { name: 'Use Template' }).click();
  await page.getByRole('button', { name: 'Create as draft' }).click();

  // Review that the document was created with the correct values.
  await page.waitForURL(/documents/);

  const documentId = Number(page.url().split('/').pop());

  const document = await prisma.document.findFirstOrThrow({
    where: {
      id: documentId,
    },
    include: {
      Recipient: true,
      documentMeta: true,
    },
  });

  expect(document.teamId).toEqual(team.id);

  const documentAuth = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
  });

  expect(document.title).toEqual('TEMPLATE_TITLE');
  expect(documentAuth.documentAuthOption.globalAccessAuth).toEqual('ACCOUNT');
  expect(documentAuth.documentAuthOption.globalActionAuth).toEqual(
    isBillingEnabled ? 'PASSKEY' : null,
  );
  expect(document.documentMeta?.dateFormat).toEqual('dd/MM/yyyy hh:mm a');
  expect(document.documentMeta?.message).toEqual('MESSAGE');
  expect(document.documentMeta?.redirectUrl).toEqual('https://documenso.com');
  expect(document.documentMeta?.subject).toEqual('SUBJECT');
  expect(document.documentMeta?.timezone).toEqual('Etc/UTC');

  const recipientOne = document.Recipient[0];
  const recipientTwo = document.Recipient[1];

  const recipientOneAuth = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
    recipientAuth: recipientOne.authOptions,
  });

  const recipientTwoAuth = extractDocumentAuthMethods({
    documentAuth: document.authOptions,
    recipientAuth: recipientTwo.authOptions,
  });

  if (isBillingEnabled) {
    expect(recipientOneAuth.derivedRecipientActionAuth).toEqual('PASSKEY');
  }

  expect(recipientOneAuth.derivedRecipientAccessAuth).toEqual('ACCOUNT');
  expect(recipientTwoAuth.derivedRecipientAccessAuth).toEqual('ACCOUNT');
});
