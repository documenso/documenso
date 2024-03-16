import { type Page } from '@playwright/test';

import { WEBAPP_BASE_URL } from '@documenso/lib/constants/app';

type LoginOptions = {
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
}: LoginOptions) => {
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

export const manualSignout = async ({ page }: LoginOptions) => {
  await page.waitForTimeout(1000);
  await page.getByTestId('menu-switcher').click();
  await page.getByRole('menuitem', { name: 'Sign Out' }).click();
  await page.waitForURL(`${WEBAPP_BASE_URL}/signin`);
};

export const apiSignin = async ({
  page,
  email = 'example@documenso.com',
  password = 'password',
  redirectPath = '/',
}: LoginOptions) => {
  const { request } = page.context();

  const csrfToken = await getCsrfToken(page);

  await request.post(`${WEBAPP_BASE_URL}/api/auth/callback/credentials`, {
    form: {
      email,
      password,
      json: true,
      csrfToken,
    },
  });

  if (redirectPath) {
    await page.goto(`${WEBAPP_BASE_URL}${redirectPath}`);
  }
};

export const apiSignout = async ({ page }: { page: Page }) => {
  const { request } = page.context();

  const csrfToken = await getCsrfToken(page);

  await request.post(`${WEBAPP_BASE_URL}/api/auth/signout`, {
    form: {
      csrfToken,
      json: true,
    },
  });

  await page.goto(`${WEBAPP_BASE_URL}/signin`);
};

const getCsrfToken = async (page: Page) => {
  const { request } = page.context();

  const response = await request.fetch(`${WEBAPP_BASE_URL}/api/auth/csrf`, {
    method: 'get',
  });

  const { csrfToken } = await response.json();
  if (!csrfToken) {
    throw new Error('Invalid session');
  }

  return csrfToken;
};
