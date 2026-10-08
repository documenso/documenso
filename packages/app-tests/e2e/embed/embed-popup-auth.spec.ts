import { EMBED_AUTH_COMPLETE_API_PATH, EMBED_AUTH_POPUP_PATH } from '@documenso/lib/constants/embed-auth';
import { createDocumentAuthOptions } from '@documenso/lib/utils/document-auth';
import { seedPendingDocumentWithFullFields } from '@documenso/prisma/seed/documents';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';
import { FieldType } from '@prisma/client';

import { waitForHydration } from '../fixtures/hydration';

const PDF_PAGE_SELECTOR = 'img[data-page-number]';

const EMBED_AUTH_PROVIDER_BUTTON_SELECTOR = 'fieldset button';

const EMBED_AUTH_COMPLETE_PAGE_PATH = '/embed/auth/complete';

// Redeem polling starts after a 5s delay and repeats every 2s.
const EMBED_REDEEM_TIMEOUT_MS = 30_000;

test.describe.configure({ mode: 'parallel', timeout: 90_000 });

test('[EMBED_POPUP_AUTH]: signs in via account popup and unlocks the embed', async ({ page, context }) => {
  const { user: owner, team } = await seedUser();

  const recipientPassword = 'password';

  const { user: recipient } = await seedUser({ password: recipientPassword });

  const { recipients } = await seedPendingDocumentWithFullFields({
    owner,
    teamId: team.id,
    recipients: [recipient],
    fields: [FieldType.SIGNATURE],
    updateDocumentOptions: {
      authOptions: createDocumentAuthOptions({
        globalAccessAuth: ['ACCOUNT'],
        globalActionAuth: [],
      }),
    },
  });

  const { token } = recipients[0];

  const embedSignPath = `/embed/sign/${token}`;

  await page.goto(embedSignPath);

  await expect(page.getByRole('alert')).toContainText('please sign in to continue');

  const signInWithEmailButton = page.getByRole('button', { name: 'Sign in with email or passkey' });

  await expect(signInWithEmailButton).toBeVisible();

  // Clicking before hydration is a no-op and the popup never opens.
  await waitForHydration(page, EMBED_AUTH_PROVIDER_BUTTON_SELECTOR);

  const popupPromise = context.waitForEvent('page');

  await signInWithEmailButton.click();

  const popup = await popupPromise;

  await popup.waitForURL((url) => url.pathname === EMBED_AUTH_POPUP_PATH);

  const popupUrl = new URL(popup.url());

  expect(popupUrl.pathname).toBe(EMBED_AUTH_POPUP_PATH);
  expect(popupUrl.searchParams.get('provider')).toBe('account');

  expect(popup.url()).not.toContain('nonce');

  await expect(popup.getByRole('heading', { name: 'Sign in to Documenso to continue' })).toBeVisible();

  await expect(page.getByText('Complete sign in in the popup window')).toBeVisible();

  // Email is prefilled from the fragment but filled explicitly to avoid timing sensitivity.
  const emailInput = popup.getByLabel('Email');

  await expect(emailInput).toBeVisible();

  await emailInput.fill(recipient.email);
  await popup.getByRole('textbox', { name: 'Password' }).fill(recipientPassword);

  // The completion page closes itself and may do so before we observe the URL.
  const completePagePromise = popup
    .waitForURL((url) => url.pathname === EMBED_AUTH_COMPLETE_PAGE_PATH && url.searchParams.get('status') === 'ok', {
      timeout: 15_000,
    })
    .then(() => 'ok' as const)
    .catch((err: unknown) => {
      if (popup.isClosed()) {
        return 'closed' as const;
      }

      throw err;
    });

  const completeResponsePromise = popup.waitForResponse(
    (response) =>
      response.request().method() === 'GET' && new URL(response.url()).pathname === EMBED_AUTH_COMPLETE_API_PATH,
    { timeout: 15_000 },
  );

  await popup.getByRole('button', { name: 'Sign In' }).click();

  const completeResponse = await completeResponsePromise;

  const completeUrl = new URL(completeResponse.url());

  expect(completeUrl.searchParams.get('state')).toBeTruthy();
  expect(completeResponse.url()).not.toContain('nonce');

  expect(completeResponse.status()).toBe(302);

  const completeLocation = completeResponse.headers().location;

  expect(completeLocation).toBeDefined();

  const completeLocationUrl = new URL(completeLocation, completeResponse.url());

  expect(completeLocationUrl.pathname).toBe(EMBED_AUTH_COMPLETE_PAGE_PATH);
  expect(completeLocationUrl.searchParams.get('status')).toBe('ok');

  const completeResult = await completePagePromise;

  expect(['ok', 'closed']).toContain(completeResult);

  if (completeResult === 'ok') {
    expect(popup.url()).not.toContain('nonce');
  }

  await expect(page.locator(PDF_PAGE_SELECTOR).first()).toBeVisible({ timeout: EMBED_REDEEM_TIMEOUT_MS });

  await expect(page.getByRole('button', { name: 'Sign in with email or passkey' })).toHaveCount(0);

  expect(new URL(page.url()).pathname).toBe(embedSignPath);

  // Over http the embed cookie has no `__Host-` prefix, is `SameSite=Lax` and not partitioned.
  const cookies = await context.cookies();

  const embedSessionCookie = cookies.find((cookie) => cookie.name === 'embedSessionId');

  expect(embedSessionCookie).toBeDefined();
  expect(embedSessionCookie?.domain).toContain('localhost');
  expect(embedSessionCookie?.secure).toBe(false);
  expect(embedSessionCookie?.httpOnly).toBe(true);
  expect(embedSessionCookie?.sameSite).toBe('Lax');

  const sessionCookie = cookies.find((cookie) => cookie.name === 'sessionId');

  expect(sessionCookie).toBeDefined();
  expect(sessionCookie?.sameSite).toBe('Lax');
});
