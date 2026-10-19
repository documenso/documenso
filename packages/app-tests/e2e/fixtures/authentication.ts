import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import type { Page } from '@playwright/test';

// Playwright's `APIRequestContext` never sends `Origin`, which the CSRF
// middleware requires on cookie-authenticated mutations.
export const WEBAPP_ORIGIN_HEADERS = {
  Origin: new URL(NEXT_PUBLIC_WEBAPP_URL()).origin,
} as const;

type LoginOptions = {
  page: Page;
  email?: string;
  password?: string;

  /**
   * Where to navigate after login.
   */
  redirectPath?: string;
};

export const apiSignin = async ({
  page,
  email = 'example@documenso.com',
  password = 'password',
  redirectPath = '/',
}: LoginOptions) => {
  const { request } = page.context();

  const csrfToken = await getCsrfToken(page);

  await request.post(`${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/email-password/authorize`, {
    headers: WEBAPP_ORIGIN_HEADERS,
    data: {
      email,
      password,
      csrfToken,
    },
  });

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}${redirectPath}`);
  await page.waitForTimeout(500);
};

export const apiSignout = async ({ page }: { page: Page }) => {
  const { request } = page.context();

  await request.post(`${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/signout`, {
    headers: WEBAPP_ORIGIN_HEADERS,
  });

  await page.goto(`${NEXT_PUBLIC_WEBAPP_URL()}/signin`);
};

const getCsrfToken = async (page: Page) => {
  const { request } = page.context();

  const response = await request.fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/csrf`, {
    method: 'get',
  });

  const { csrfToken } = await response.json();

  if (!csrfToken) {
    throw new Error('Invalid session');
  }

  return csrfToken;
};

export const checkSessionValid = async (page: Page): Promise<boolean> => {
  const { request } = page.context();

  const response = await request.fetch(`${NEXT_PUBLIC_WEBAPP_URL()}/api/auth/session`, {
    method: 'get',
  });

  const session = await response.json();

  return session.isAuthenticated === true;
};
