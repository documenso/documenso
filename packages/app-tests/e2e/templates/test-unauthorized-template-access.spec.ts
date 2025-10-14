import { expect, test } from '@playwright/test';

import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { seedBlankTemplate } from '@documenso/prisma/seed/templates';
import { seedUser } from '@documenso/prisma/seed/users';

import { apiSignin } from '../fixtures/authentication';

test.describe.configure({
  mode: 'parallel',
});

test.describe('Unauthorized Access to Templates', () => {
  test('should block unauthorized access to the template page', async ({ page }) => {
    const { user, team } = await seedUser();
    const template = await seedBlankTemplate(user, team.id);

    const { user: unauthorizedUser } = await seedUser();

    await apiSignin({
      page,
      email: unauthorizedUser.email,
      redirectPath: `/t/${team.url}/templates/${template.id}`,
    });

    await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/templates/${template.id}`);
    await expect(page.getByRole('heading', { name: 'Team not found' })).toBeVisible();
  });

  test('should block unauthorized access to the template edit page', async ({ page }) => {
    const { user, team } = await seedUser();
    const template = await seedBlankTemplate(user, team.id);

    const { user: unauthorizedUser } = await seedUser();

    await apiSignin({
      page,
      email: unauthorizedUser.email,
      redirectPath: `/t/${team.url}/templates/${template.id}/edit`,
    });

    await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/t/${team.url}/templates/${template.id}/edit`);
    await expect(page.getByRole('heading', { name: 'Team not found' })).toBeVisible();
  });
});
