import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { customAlphabet } from 'nanoid';

import { apiSignin } from '../../fixtures/authentication';

test.describe.configure({ mode: 'parallel' });

const nanoid = customAlphabet('1234567890abcdef', 12);

const seedAdminAndMember = async () => {
  const token = nanoid();

  const { user: adminUser } = await seedUser({
    isAdmin: true,
    name: `${token} Admin`,
  });

  const { user: memberUser } = await seedUser({
    isAdmin: false,
    name: `${token} Member`,
  });

  return { token, adminUser, memberUser };
};

test('[ADMIN][FILTER_USERS]: filtering by the admin role only lists admins', async ({ page }) => {
  const { token, adminUser, memberUser } = await seedAdminAndMember();

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: '/admin/users',
  });

  await page.getByPlaceholder('Search by name or email').fill(token);

  await expect(page.getByRole('cell', { name: adminUser.email })).toBeVisible();
  await expect(page.getByRole('cell', { name: memberUser.email })).toBeVisible();

  await page.getByRole('combobox', { name: 'Filter by role' }).click();
  await page.getByRole('option', { name: 'Admin' }).click();

  await expect(page).toHaveURL(/role=ADMIN/);
  await expect(page.getByRole('cell', { name: adminUser.email })).toBeVisible();
  await expect(page.getByRole('cell', { name: memberUser.email })).not.toBeVisible();

  await page.getByRole('combobox', { name: 'Filter by role' }).click();
  await page.getByRole('option', { name: 'All roles' }).click();

  await expect(page).not.toHaveURL(/role=/);
  await expect(page.getByRole('cell', { name: memberUser.email })).toBeVisible();
});

test('[ADMIN][FILTER_USERS]: an unknown role param is ignored instead of filtering', async ({ page }) => {
  const { token, adminUser, memberUser } = await seedAdminAndMember();

  await apiSignin({
    page,
    email: adminUser.email,
    redirectPath: '/admin/users?role=SUPERUSER',
  });

  await expect(page.getByRole('combobox', { name: 'Filter by role' })).toHaveText('All roles');

  await page.getByPlaceholder('Search by name or email').fill(token);

  await expect(page.getByRole('cell', { name: adminUser.email })).toBeVisible();
  await expect(page.getByRole('cell', { name: memberUser.email })).toBeVisible();
});
