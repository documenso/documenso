import { expect, test } from '@playwright/test';
import { TeamMemberRole } from '@prisma/client';

import { prisma } from '@documenso/prisma';
import { seedUserSubscription } from '@documenso/prisma/seed/subscriptions';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe('[EE_ONLY]', () => {
  const enterprisePriceId = '';

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
      redirectPath: `/templates/${template.id}/edit`,
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
      redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
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
      redirectPath: `/templates/${template.id}/edit`,
    });

    // Global action auth should not be visible.
    await expect(page.getByTestId('documentActionSelectValue')).not.toBeVisible();

    // Next step.
    await page.getByRole('button', { name: 'Continue' }).click();
    await expect(page.getByRole('heading', { name: 'Add Placeholders' })).toBeVisible();

    // Advanced settings should not be visible.
    await expect(page.getByLabel('Show advanced settings')).not.toBeVisible();
  });
});

test('[TEMPLATE_FLOW]: add settings', async ({ page }) => {
  const { user, team } = await seedUser();
  const template = await seedBlankTemplate(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
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
});

test('[TEMPLATE_FLOW] add document visibility settings', async ({ page }) => {
  const { user, team } = await seedUser();

  const template = await seedBlankTemplate(user, team.id);

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
  });

  // Set document visibility.
  await page.getByTestId('documentVisibilitySelectValue').click();
  await page.getByLabel('Managers and above').click();
  await expect(page.getByTestId('documentVisibilitySelectValue')).toContainText(
    'Managers and above',
  );

  // Save the settings by going to the next step.
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholders' })).toBeVisible();

  // Navigate back to the edit page to check that the settings are saved correctly.
  await page.goto(`/t/${team.url}/templates/${template.id}/edit`);

  await expect(page.getByRole('heading', { name: 'General' })).toBeVisible();
  await expect(page.getByTestId('documentVisibilitySelectValue')).toContainText(
    'Managers and above',
  );
});

test('[TEMPLATE_FLOW] team member visibility permissions', async ({ page }) => {
  const { team, owner, organisation } = await seedTeam({
    createTeamMembers: 2, // Create an additional member to test different roles
  });

  await prisma.teamMember.update({
    where: {
      id: team.members[1].id,
    },
    data: {
      role: TeamMemberRole.MANAGER,
    },
  });

  const managerUser = team.members[1].user;
  const memberUser = team.members[2].user;

  const template = await seedBlankTemplate(owner, team.id, {
    createTemplateOptions: {
      teamId: team.id,
    },
  });

  // Test as manager
  await apiSignin({
    page,
    email: managerUser.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
  });

  // Manager should be able to set visibility to managers and above
  await page.getByTestId('documentVisibilitySelectValue').click();
  await page.getByLabel('Managers and above').click();
  await expect(page.getByTestId('documentVisibilitySelectValue')).toContainText(
    'Managers and above',
  );
  await expect(page.getByText('Admins only')).toBeDisabled();

  // Save and verify
  await page.getByRole('button', { name: 'Continue' }).click();
  await expect(page.getByRole('heading', { name: 'Add Placeholders' })).toBeVisible();

  // Test as regular member
  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
  });

  // Regular member should not be able to modify visibility when set to managers and above
  await expect(page.getByTestId('documentVisibilitySelectValue')).toBeDisabled();

  // Create a new template with 'everyone' visibility
  const everyoneTemplate = await seedBlankTemplate(owner, team.id, {
    createTemplateOptions: {
      teamId: team.id,
      visibility: 'EVERYONE',
    },
  });

  // Navigate to the new template
  await page.goto(`/t/${team.url}/templates/${everyoneTemplate.id}/edit`);

  // Regular member should be able to see but not modify visibility
  await expect(page.getByTestId('documentVisibilitySelectValue')).toBeDisabled();
  await expect(page.getByTestId('documentVisibilitySelectValue')).toContainText('Everyone');
});
