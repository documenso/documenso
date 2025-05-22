import { expect, test } from '@playwright/test';

import {
  seedBlankDocument,
  seedDraftDocument,
  seedPendingDocument,
} from '@documenso/prisma/seed/documents';
import { seedUserSubscription } from '@documenso/prisma/seed/subscriptions';
import { seedTeam } from '@documenso/prisma/seed/teams';
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

  test('[DOCUMENT_FLOW] add action auth settings', async ({ page }) => {
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

    // Set EE action auth.
    await page.getByTestId('documentActionSelectValue').click();
    await page.getByLabel('Require passkey').getByText('Require passkey').click();
    await expect(page.getByTestId('documentActionSelectValue')).toContainText('Require passkey');

    // Save the settings by going to the next step.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

    // Return to the settings step to check that the results are saved correctly.
    await page.getByRole('button', { name: 'Go Back' }).click();
    await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

    await expect(page.getByTestId('documentActionSelectValue')).toContainText('Require passkey');
  });

  test('[DOCUMENT_FLOW] enterprise team member can add action auth settings', async ({ page }) => {
    const team = await seedTeam({
      createTeamMembers: 1,
    });

    const owner = team.owner;
    const teamMemberUser = team.members[1].user;

    // Make the team enterprise by giving the owner the enterprise subscription.
    await seedUserSubscription({
      userId: team.ownerUserId,
      priceId: enterprisePriceId,
    });

    const document = await seedBlankDocument(owner, {
      createDocumentOptions: {
        teamId: team.id,
      },
    });

    await apiSignin({
      page,
      email: teamMemberUser.email,
      redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
    });

    // Set EE action auth.
    await page.getByTestId('documentActionSelectValue').click();
    await page.getByLabel('Require passkey').getByText('Require passkey').click();
    await expect(page.getByTestId('documentActionSelectValue')).toContainText('Require passkey');

    // Save the settings by going to the next step.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

    // Advanced settings should be visible.
    await expect(page.getByLabel('Show advanced settings')).toBeVisible();
  });

  test('[DOCUMENT_FLOW] enterprise team member should not have access to enterprise on personal account', async ({
    page,
  }) => {
    const team = await seedTeam({
      createTeamMembers: 1,
    });

    const teamMemberUser = team.members[1].user;

    // Make the team enterprise by giving the owner the enterprise subscription.
    await seedUserSubscription({
      userId: team.ownerUserId,
      priceId: enterprisePriceId,
    });

    const document = await seedBlankDocument(teamMemberUser);

    await apiSignin({
      page,
      email: teamMemberUser.email,
      redirectPath: `/documents/${document.id}/edit`,
    });

    // Global action auth should not be visible.
    await expect(page.getByTestId('documentActionSelectValue')).not.toBeVisible();

    // Next step.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

    // Advanced settings should not be visible.
    await expect(page.getByLabel('Show advanced settings')).not.toBeVisible();
  });
});

test('[DOCUMENT_FLOW]: add settings', async ({ page }) => {
  const { user, team } = await seedUser();
  const document = await seedBlankDocument(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${document.id}/edit`,
  });

  // Set title.
  await page.getByLabel('Title').fill('New Title');

  // Set access auth.
  await page.getByTestId('documentAccessSelectValue').click();
  await page.getByLabel('Require account').getByText('Require account').click();
  await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');

  // Action auth should NOT be visible.
  await expect(page.getByTestId('documentActionSelectValue')).not.toBeVisible();

  // Save the settings by going to the next step.

  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Signers' })).toBeVisible();

  // Return to the settings step to check that the results are saved correctly.
  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  await expect(page.getByLabel('Title')).toHaveValue('New Title');
  await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');
});

test('[DOCUMENT_FLOW]: title should be disabled depending on document status', async ({ page }) => {
  const { user, team } = await seedUser();

  const pendingDocument = await seedPendingDocument(user, team.id, []);
  const draftDocument = await seedDraftDocument(user, team.id, []);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/documents/${pendingDocument.id}/edit`,
  });

  // Should be disabled for pending documents.
  await expect(page.getByLabel('Title')).toBeDisabled();

  // Should be enabled for draft documents.
  await page.goto(`/t/${team.url}/documents/${draftDocument.id}/edit`);
  await expect(page.getByLabel('Title')).toBeEnabled();
});
