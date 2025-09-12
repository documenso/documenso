import { expect, test } from '@playwright/test';
import { TeamMemberRole } from '@prisma/client';

import { mapSecondaryIdToTemplateId } from '@documenso/lib/utils/envelope';
import { seedTeam, seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

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
  await page.getByRole('option').filter({ hasText: 'Require account' }).click();
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

  const memberUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MEMBER,
  });

  const managerUser = await seedTeamMember({
    teamId: team.id,
    role: TeamMemberRole.MANAGER,
  });

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

  // A regular member should not be able to see the template.
  // They should be redirected to the templates page.
  await expect(page.getByText('Not Found').first()).toBeVisible();
  await page.goto(`/t/${team.url}/templates`);

  // Create a new template with 'everyone' visibility
  const everyoneTemplate = await seedBlankTemplate(owner, team.id, {
    createTemplateOptions: {
      teamId: team.id,
      visibility: 'EVERYONE',
    },
  });

  // Navigate to the new template
  await page.goto(
    `/t/${team.url}/templates/${mapSecondaryIdToTemplateId(everyoneTemplate.secondaryId)}/edit`,
  );

  // Regular member should be able to see but not modify visibility
  await expect(page.getByTestId('documentVisibilitySelectValue')).toBeDisabled();
  await expect(page.getByTestId('documentVisibilitySelectValue')).toContainText('Everyone');
});
