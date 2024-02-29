import type { Page } from '@playwright/test';

import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';

type ManualLoginOptions = {
  page: Page;
  email?: string;
  password?: string;

  /**
   * Where to navigate after login.
   */
  redirectPath?: string;
};

export const manualLogin = async ({
  page,
  email = 'example@documenso.com',
  password = 'password',
  redirectPath,
}: ManualLoginOptions) => {
  await page.goto(`${WEBAPP_BASE_URL}/signin`);

  await page.getByLabel('Email').click();
  await page.getByLabel('Email').fill(email);

  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByLabel('Password', { exact: true }).press('Enter');

  if (redirectPath) {
    await page.waitForURL(`${WEBAPP_BASE_URL}/documents`);
    await page.goto(`${WEBAPP_BASE_URL}${redirectPath}`);
  }
};

export const manualSignout = async ({ page }: ManualLoginOptions) => {
  await page.waitForTimeout(1000);
  await page.getByTestId('menu-switcher').click();
  await page.getByRole('menuitem', { name: 'Sign Out' }).click();
  await page.waitForURL(`${WEBAPP_BASE_URL}/signin`);
};
