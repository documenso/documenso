import { expect, test } from '@playwright/test';

import { prisma } from '@documenso/prisma';
import { seedOrganisationMembers } from '@documenso/prisma/seed/organisations';
import { seedTeamMember } from '@documenso/prisma/seed/teams';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[BRANDING_LOGO_SIZE_INTEGRATION]: non-admin user cannot update team branding', async ({
  page,
}) => {
  const { user: adminUser, team } = await seedUser();

  // Create a non-admin team member
  const memberUser = await seedTeamMember({
    teamId: team.id,
    role: 'MEMBER',
  });

  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/t/${team.url}/documents`,
  });

  // Attempt to navigate to branding settings - should not have access
  await page.goto(`/t/${team.url}/settings/branding`);

  // Should be redirected or shows error
  const pageContent = await page.content();
  const isUnauthorized =
    pageContent.includes('not authorized') ||
    pageContent.includes('permission') ||
    pageContent.includes('Unauthorized') ||
    page.url().includes('/unauthorized') ||
    !page.url().includes('/settings/branding');

  expect(isUnauthorized).toBeTruthy();
});

test('[BRANDING_LOGO_SIZE_INTEGRATION]: organization admin can update organization branding', async ({
  page,
}) => {
  const { user, organisation } = await seedUser({
    roles: {
      organisationRole: 'ADMIN',
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/o/${organisation.url}/settings/branding`,
  });

  // Should be able to access the page
  await expect(page.getByRole('heading', { name: 'Branding Preferences' })).toBeVisible();

  // Wait for the form to load and element to be visible
  await expect(page.getByTestId('enable-branding')).toBeVisible();

  // Enable branding and set logo size
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).first().click();

  // Click logo size select button
  const logoSizeLabel = page.getByText('Logo Size');
  const logoSizeButton = logoSizeLabel.locator('..').locator('button').first();
  await logoSizeButton.click();
  await page.getByRole('option', { name: 'Large', exact: true }).click();

  // Save
  await page.getByRole('button', { name: 'Update' }).click();

  // Wait for toast
  await page.waitForTimeout(2000);

  // Verify it was saved
  const orgSettings = await prisma.organisation.findUnique({
    where: { id: organisation.id },
    include: { organisationGlobalSettings: true },
  });

  expect(orgSettings?.organisationGlobalSettings?.brandingLogoSize).toBe('h-12');
});

test('[BRANDING_LOGO_SIZE_INTEGRATION]: non-admin organization member cannot update branding', async ({
  page,
}) => {
  const { user: adminUser, organisation } = await seedUser({
    roles: {
      organisationRole: 'ADMIN',
    },
  });

  // Create a non-admin org member
  const [memberUser] = await seedOrganisationMembers({
    organisationId: organisation.id,
    members: [
      {
        organisationRole: 'MEMBER',
      },
    ],
  });

  await apiSignin({
    page,
    email: memberUser.email,
    redirectPath: `/o/${organisation.url}/documents`,
  });

  // Attempt to navigate to branding settings
  await page.goto(`/o/${organisation.url}/settings/branding`);

  // Should be redirected or shows error
  const pageContent = await page.content();
  const isUnauthorized =
    pageContent.includes('not authorized') ||
    pageContent.includes('permission') ||
    pageContent.includes('Unauthorized') ||
    page.url().includes('/unauthorized') ||
    !page.url().includes('/settings/branding');

  expect(isUnauthorized).toBeTruthy();
});

test('[BRANDING_LOGO_SIZE_INTEGRATION]: changing branding disable does not affect logo size', async ({
  page,
}) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/branding`,
  });

  // Wait for the page to fully load and heading to be visible
  await expect(page.getByRole('heading', { name: 'Branding Preferences' })).toBeVisible();
  await expect(page.getByTestId('enable-branding')).toBeVisible();

  // Enable branding and set logo size
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).first().click();

  const logoSizeLabel3 = page.getByText('Logo Size');
  const logoSizeButton3 = logoSizeLabel3.locator('..').locator('button').first();
  await logoSizeButton3.click();
  await page.getByRole('option', { name: 'Large', exact: true }).click();

  await page.getByRole('button', { name: 'Update' }).click();
  await page.waitForTimeout(1500);

  // Disable branding
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'No' }).first().click();
  await page.getByRole('button', { name: 'Update' }).click();
  await page.waitForTimeout(1500);

  // Enable branding again
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).first().click();
  await page.getByRole('button', { name: 'Update' }).click();
  await page.waitForTimeout(1500);

  // Logo size should still be Large
  const teamSettings = await prisma.team.findUnique({
    where: { id: team.id },
    include: { teamGlobalSettings: true },
  });

  expect(teamSettings?.teamGlobalSettings?.brandingLogoSize).toBe('h-12');
});

test('[BRANDING_LOGO_SIZE_INTEGRATION]: team can have different logo sizes than parent organization', async ({
  page,
}) => {
  const { user, organisation, team } = await seedUser();

  // Set org logo size to Small
  await prisma.organisation.update({
    where: { id: organisation.id },
    data: {
      organisationGlobalSettings: {
        update: {
          brandingLogoSize: 'h-6',
        },
      },
    },
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/branding`,
  });

  // Wait for the page to fully load and heading to be visible
  await expect(page.getByRole('heading', { name: 'Branding Preferences' })).toBeVisible();
  await expect(page.getByTestId('enable-branding')).toBeVisible();

  // Enable branding for team
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).first().click();

  // Set team logo size to Extra large
  const logoSizeLabel2 = page.getByText('Logo Size');
  const logoSizeButton2 = logoSizeLabel2.locator('..').locator('button').first();
  await logoSizeButton2.click();
  await page.getByRole('option', { name: 'Extra large' }).click();

  await page.getByRole('button', { name: 'Update' }).click();
  await page.waitForTimeout(1500);

  // Verify both are set correctly
  const teamSettings = await prisma.team.findUnique({
    where: { id: team.id },
    include: { teamGlobalSettings: true },
  });
  const orgSettings = await prisma.organisation.findUnique({
    where: { id: organisation.id },
    include: { organisationGlobalSettings: true },
  });

  expect(teamSettings?.teamGlobalSettings?.brandingLogoSize).toBe('h-16');
  expect(orgSettings?.organisationGlobalSettings?.brandingLogoSize).toBe('h-6');
});

test('[BRANDING_LOGO_SIZE_INTEGRATION]: all logo sizes render correctly in UI', async ({
  page,
}) => {
  const { user, team } = await seedUser();

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/branding`,
  });

  // Wait for the page to fully load and heading to be visible
  await expect(page.getByRole('heading', { name: 'Branding Preferences' })).toBeVisible();
  await expect(page.getByTestId('enable-branding')).toBeVisible();

  // Enable branding
  await page.getByTestId('enable-branding').click();
  await page.getByRole('option', { name: 'Yes' }).first().click();

  // Check that all size options are available in dropdown
  const logoSizeLabelCheck = page.getByText('Logo Size');
  const logoSizeButtonCheck = logoSizeLabelCheck.locator('..').locator('button').first();
  await logoSizeButtonCheck.click();

  const sizeLabels = ['Small', 'Medium', 'Large', 'Extra large'];
  for (const label of sizeLabels) {
    const option = page.getByRole('option', { name: label, exact: label === 'Large' });
    await expect(option).toBeVisible();
  }

  // Click outside to close dropdown
  await page.keyboard.press('Escape');
});
