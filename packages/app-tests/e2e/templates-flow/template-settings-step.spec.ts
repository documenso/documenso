import { expect, test } from '@playwright/test';

import { seedUserSubscription } from '@documenso/prisma/seed/subscriptions';
import { seedTeam, unseedTeam } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser, unseedUser } from '@documenso/prisma/seed/users';

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

  test('[TEMPLATE_FLOW] add action auth settings', async ({ page }) => {
    const user = await seedUser();

    await seedUserSubscription({
      userId: user.id,
      priceId: enterprisePriceId,
    });

    const template = await seedBlankTemplate(user);

    await apiSignin({
      page,
      email: user.email,
      redirectPath: `/templates/${template.id}`,
    });

    // Set EE action auth.
    await page.getByTestId('documentActionSelectValue').click();
    await page.getByLabel('Require passkey').getByText('Require passkey').click();
    await expect(page.getByTestId('documentActionSelectValue')).toContainText('Require passkey');

    // Save the settings by going to the next step.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Placeholders' })).toBeVisible();

    // Return to the settings step to check that the results are saved correctly.
    await page.getByRole('button', { name: 'Go Back' }).click();
    await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

    await expect(page.getByTestId('documentActionSelectValue')).toContainText('Require passkey');

    await unseedUser(user.id);
  });

  test('[TEMPLATE_FLOW] enterprise team member can add action auth settings', async ({ page }) => {
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

    const template = await seedBlankTemplate(owner, {
      createTemplateOptions: {
        teamId: team.id,
      },
    });

    await apiSignin({
      page,
      email: teamMemberUser.email,
      redirectPath: `/t/${team.url}/templates/${template.id}`,
    });

    // Set EE action auth.
    await page.getByTestId('documentActionSelectValue').click();
    await page.getByLabel('Require passkey').getByText('Require passkey').click();
    await expect(page.getByTestId('documentActionSelectValue')).toContainText('Require passkey');

    // Save the settings by going to the next step.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Placeholders' })).toBeVisible();

    // Advanced settings should be visible.
    await expect(page.getByLabel('Show advanced settings')).toBeVisible();

    await unseedTeam(team.url);
  });

  test('[TEMPLATE_FLOW] enterprise team member should not have access to enterprise on personal account', async ({
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

    const template = await seedBlankTemplate(teamMemberUser);

    await apiSignin({
      page,
      email: teamMemberUser.email,
      redirectPath: `/templates/${template.id}`,
    });

    // Global action auth should not be visible.
    await expect(page.getByTestId('documentActionSelectValue')).not.toBeVisible();

    // Next step.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Placeholders' })).toBeVisible();

    // Advanced settings should not be visible.
    await expect(page.getByLabel('Show advanced settings')).not.toBeVisible();

    await unseedTeam(team.url);
  });
});

test('[TEMPLATE_FLOW]: add settings', async ({ page }) => {
  const user = await seedUser();
  const template = await seedBlankTemplate(user);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/templates/${template.id}`,
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
  await expect(page.getByRole('heading', { name: 'Add Placeholders' })).toBeVisible();

  // Return to the settings step to check that the results are saved correctly.
  await page.getByRole('button', { name: 'Go Back' }).click();
  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();

  await expect(page.getByLabel('Title')).toHaveValue('New Title');
  await expect(page.getByTestId('documentAccessSelectValue')).toContainText('Require account');

  await unseedUser(user.id);
});
