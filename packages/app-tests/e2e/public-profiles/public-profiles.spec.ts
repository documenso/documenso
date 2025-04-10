import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { seedTeam } from '@documenso/prisma/seed/teams';
import { seedDirectTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

test('[PUBLIC_PROFILE]: create profile', async ({ page }) => {
  const user = await seedUser();

  // Create direct template.
  const directTemplate = await seedDirectTemplate({
    userId: user.id,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: '/settings/public-profile',
  });

  const publicProfileUrl = Date.now().toString();
  const publicProfileBio = `public-profile-bio`;

  await page.getByRole('textbox', { name: 'Public profile URL' }).click();
  await page.getByRole('textbox', { name: 'Public profile URL' }).fill(publicProfileUrl);

  await page.getByRole('textbox', { name: 'Bio' }).click();
  await page.getByRole('textbox', { name: 'Bio' }).fill(publicProfileBio);

  await page.getByRole('button', { name: 'Update' }).click();

  await expect(page.getByRole('status').first()).toContainText(
    'Your public profile has been updated.',
  );

  // Link direct template to public profile.
  await page.getByRole('button', { name: 'Link template' }).click();
  await page.getByRole('cell', { name: directTemplate.title }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('textbox', { name: 'Title *' }).fill('public-direct-template-title');
  await page
    .getByRole('textbox', { name: 'Description *' })
    .fill('public-direct-template-description');
  await page.getByRole('button', { name: 'Update' }).click();

  // Check that public profile is disabled.
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/p/${publicProfileUrl}`);
  await expect(page.locator('body')).toContainText('404 Profile not found');

  // Go back to public profile page.
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/settings/public-profile`);
  await page.getByRole('switch').click();
  await page.waitForTimeout(1000);

  // Assert values.
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/p/${publicProfileUrl}`);
  await expect(page.getByRole('main')).toContainText(publicProfileBio);
  await expect(page.locator('body')).toContainText('public-direct-template-title');
  await expect(page.locator('body')).toContainText('public-direct-template-description');

  await page.getByRole('link', { name: 'Sign' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();

  await expect(page.getByRole('heading', { name: 'Document Signed' })).toBeVisible();
  await expect(page.getByRole('heading')).toContainText('Document Signed');
});

test('[PUBLIC_PROFILE]: create team profile', async ({ page }) => {
  const team = await seedTeam({
    createTeamMembers: 1,
  });

  const user = team.owner;

  // Create direct template.
  const directTemplate = await seedDirectTemplate({
    userId: user.id,
    teamId: team.id,
  });

  // Create non team template to make sure you can only see the team one.
  // Will be indirectly asserted because test should fail when 2 elements appear.
  await seedDirectTemplate({
    userId: user.id,
  });

  await apiSignin({
    page,
    email: user.email,
    redirectPath: `/t/${team.url}/settings/public-profile`,
  });

  const publicProfileUrl = team.url;
  const publicProfileBio = `public-profile-bio`;

  await page.getByRole('textbox', { name: 'Bio' }).click();
  await page.getByRole('textbox', { name: 'Bio' }).fill(publicProfileBio);

  await page.getByRole('button', { name: 'Update' }).click();

  await expect(page.getByRole('status').first()).toContainText(
    'Your public profile has been updated.',
  );

  // Link direct template to public profile.
  await page.getByRole('button', { name: 'Link template' }).click();
  await page.getByRole('cell', { name: directTemplate.title }).click();
  await page.getByRole('button', { name: 'Continue' }).click();

  await page.getByRole('textbox', { name: 'Title *' }).fill('public-direct-template-title');
  await page
    .getByRole('textbox', { name: 'Description *' })
    .fill('public-direct-template-description');
  await page.getByRole('button', { name: 'Update' }).click();

  // Check that public profile is disabled.
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/p/${publicProfileUrl}`);
  await expect(page.locator('body')).toContainText('404 Profile not found');

  // Go back to public profile page.
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/settings/public-profile`);
  await page.getByRole('switch').click();
  await page.waitForTimeout(1000);

  // Assert values.
  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/p/${publicProfileUrl}`);
  await expect(page.getByRole('main')).toContainText(publicProfileBio);
  await expect(page.locator('body')).toContainText('public-direct-template-title');
  await expect(page.locator('body')).toContainText('public-direct-template-description');

  await page.getByRole('link', { name: 'Sign' }).click();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: 'Complete' }).click();
  await page.getByRole('button', { name: 'Sign' }).click();

  await expect(page.getByRole('heading', { name: 'Document Signed' })).toBeVisible();
  await expect(page.getByRole('heading')).toContainText('Document Signed');
});
