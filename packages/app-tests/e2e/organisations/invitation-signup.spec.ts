import { NEXT_PUBLIC_WEBAPP_URL } from '@documenso/lib/constants/app';
import { USER_SIGNUP_VERIFICATION_TOKEN_IDENTIFIER } from '@documenso/lib/constants/email';
import { prisma } from '@documenso/prisma';
import { seedOrganisationMemberInvite } from '@documenso/prisma/seed/organisations';
import { seedUser } from '@documenso/prisma/seed/users';
import { expect, test } from '@playwright/test';

import { WEBAPP_ORIGIN_HEADERS } from '../fixtures/authentication';
import { waitForConfirmationEmail } from '../fixtures/email';
import { waitForHydration } from '../fixtures/hydration';

test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Organisation invitation onboarding', () => {
  test('verifies a new account in another browser before accepting the invitation', async ({ page, browser }) => {
    const { invitation, organisation } = await seedInvitation();
    const returnTo = `/organisation/invite/${invitation.token}`;

    await page.goto(returnTo);
    await page.getByRole('link', { name: 'Create account', exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/signup' && url.searchParams.get('returnTo') === returnTo);
    await expect(page.getByLabel('Email Address', { exact: true })).toHaveValue(invitation.email);

    // Switching auth forms must not lose the pending invitation.
    await page.getByRole('link', { name: 'Sign in instead' }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/signin' && url.searchParams.get('returnTo') === returnTo);
    await page.getByRole('link', { name: 'Sign up', exact: true }).click();
    await expect(page).toHaveURL((url) => url.pathname === '/signup' && url.searchParams.get('returnTo') === returnTo);
    await waitForHydration(page, 'input[name="name"]');

    await page.getByLabel('Full Name', { exact: true }).fill('Invited User');
    await page.getByLabel('Email Address', { exact: true }).fill(invitation.email);
    await page.getByLabel('Password', { exact: true }).fill('Password123#');
    await page.getByTestId('signature-pad-dialog-button').click();
    await page.getByRole('tab', { name: 'Type', exact: true }).click();
    await page.getByTestId('signature-pad-type-input').fill('Invited User');
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await page.getByRole('button', { name: 'Create account', exact: true }).click();

    await expect(page).toHaveURL(
      (url) => url.pathname === '/unverified-account' && url.searchParams.get('returnTo') === returnTo,
    );
    await expect(page.getByRole('heading', { name: 'Confirm email', exact: true })).toBeVisible();

    const user = await prisma.user.findUniqueOrThrow({ where: { email: invitation.email } });
    expect(user.emailVerified).toBeNull();

    // Returning to the invitation while unverified keeps the user on the confirmation step.
    await page.goto(returnTo);
    await expect(page).toHaveURL(
      (url) => url.pathname === '/unverified-account' && url.searchParams.get('returnTo') === returnTo,
    );
    await expect(page.getByRole('heading', { name: 'Confirm email', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Accept', exact: true })).toHaveCount(0);

    const confirmation = await waitForConfirmationEmail(page.request, invitation.email);
    expect(confirmation.url.searchParams.get('returnTo')).toBe(returnTo);

    const verificationContext = await browser.newContext({ baseURL: NEXT_PUBLIC_WEBAPP_URL() });

    try {
      const verificationPage = await verificationContext.newPage();
      await verificationPage.goto(confirmation.url.toString());
      await expect(verificationPage.getByRole('heading', { name: 'Email Confirmed!', exact: true })).toBeVisible();
      await expect(verificationPage).toHaveURL(confirmation.url.toString());
      await expectInvitationPending(invitation.id, organisation.id, user.id);
      await expect(verificationPage.getByRole('link', { name: 'Continue', exact: true })).toHaveAttribute(
        'href',
        returnTo,
      );
      await verificationPage.getByRole('link', { name: 'Continue', exact: true }).click();
      await expect(verificationPage).toHaveURL(returnTo);
      await expect(verificationPage.getByRole('button', { name: 'Accept', exact: true })).toBeVisible();

      const sessionResponse = await verificationContext.request.get('/api/auth/session-json');
      expect(await sessionResponse.json()).toMatchObject({
        json: { isAuthenticated: true, user: { id: user.id, email: invitation.email } },
      });
      await expectInvitationPending(invitation.id, organisation.id, user.id);

      await verificationPage.getByRole('button', { name: 'Accept', exact: true }).click();
      await expect(verificationPage.getByRole('heading', { name: 'Invitation accepted!' })).toBeVisible();
      await expect(verificationPage.getByRole('link', { name: 'Continue', exact: true })).toHaveAttribute('href', '/');
      expect(
        await prisma.organisationMember.count({ where: { organisationId: organisation.id, userId: user.id } }),
      ).toBe(1);
      expect(await prisma.organisationMemberInvite.findUniqueOrThrow({ where: { id: invitation.id } })).toMatchObject({
        status: 'ACCEPTED',
      });
      expect(await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).toMatchObject({
        emailVerified: expect.any(Date),
      });
    } finally {
      await verificationContext.close();
    }
  });

  test('rejects acceptance over the API until the email is verified', async ({ request }) => {
    const { user } = await seedUser({ verified: false });
    const { invitation, organisation } = await seedInvitation(user.email);

    // The token endpoint must enforce verification itself, independently of the UI redirect.
    const acceptResponse = await request.post('/api/trpc/organisation.member.invite.accept', {
      headers: WEBAPP_ORIGIN_HEADERS,
      data: { json: { token: invitation.token } },
    });

    expect(acceptResponse.status()).toBe(403);
    expect(await acceptResponse.json()).toMatchObject({
      error: { json: { data: { code: 'UNVERIFIED_EMAIL', httpStatus: 403 } } },
    });
    await expectInvitationPending(invitation.id, organisation.id, user.id);
  });

  test('preserves an existing unverified user invitation through signin, resend and expired-token replacement', async ({
    page,
    browser,
  }) => {
    const { user } = await seedUser({ verified: false });
    const { invitation, organisation } = await seedInvitation(user.email);
    const returnTo = `/organisation/invite/${invitation.token}`;

    await page.goto(`/signin?returnTo=${encodeURIComponent(returnTo)}`);
    await waitForHydration(page, 'input[name="email"]');
    await page.getByLabel('Email', { exact: true }).fill(user.email);
    await page.getByLabel('Password', { exact: true }).fill('password');
    await page.getByRole('button', { name: 'Sign In', exact: true }).click();
    await expect(page).toHaveURL(
      (url) => url.pathname === '/unverified-account' && url.searchParams.get('returnTo') === returnTo,
    );

    // A first sign-in with no outstanding token sends a confirmation email carrying the invitation.
    const initialConfirmation = await waitForConfirmationEmail(page.request, user.email);
    expect(initialConfirmation.url.searchParams.get('returnTo')).toBe(returnTo);

    await page.getByLabel('Email address', { exact: true }).fill(user.email);
    await page.getByRole('button', { name: 'Send confirmation email', exact: true }).click();
    const resentConfirmation = await waitForConfirmationEmail(page.request, user.email, [initialConfirmation.id]);
    expect(resentConfirmation.url.searchParams.get('returnTo')).toBe(returnTo);

    // Move tokens beyond both expiry and the replacement-email throttle without waiting an hour.
    await prisma.verificationToken.updateMany({
      where: { userId: user.id, identifier: USER_SIGNUP_VERIFICATION_TOKEN_IDENTIFIER },
      data: {
        createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        expires: new Date(Date.now() - 60 * 60 * 1000),
      },
    });

    const verificationContext = await browser.newContext({ baseURL: NEXT_PUBLIC_WEBAPP_URL() });

    try {
      const verificationPage = await verificationContext.newPage();
      await verificationPage.goto(resentConfirmation.url.toString());
      await expect(verificationPage.getByRole('heading', { name: 'Your token has expired!' })).toBeVisible();
      await expectInvitationPending(invitation.id, organisation.id, user.id);

      const replacement = await waitForConfirmationEmail(page.request, user.email, [
        initialConfirmation.id,
        resentConfirmation.id,
      ]);
      expect(replacement.url.searchParams.get('returnTo')).toBe(returnTo);
      expect(replacement.url.pathname).not.toBe(resentConfirmation.url.pathname);

      await verificationPage.goto(replacement.url.toString());
      await expect(verificationPage.getByRole('heading', { name: 'Email Confirmed!', exact: true })).toBeVisible();
      await expect(verificationPage).toHaveURL(replacement.url.toString());
      await expectInvitationPending(invitation.id, organisation.id, user.id);
      await expect(verificationPage.getByRole('link', { name: 'Continue', exact: true })).toHaveAttribute(
        'href',
        returnTo,
      );
      await verificationPage.getByRole('link', { name: 'Continue', exact: true }).click();
      await expect(verificationPage).toHaveURL(returnTo);
      await expect(verificationPage.getByRole('button', { name: 'Accept', exact: true })).toBeVisible();
    } finally {
      await verificationContext.close();
    }
  });

  test('allows declining an invitation without creating or verifying an account', async ({ page }) => {
    const { invitation } = await seedInvitation();

    await page.goto(`/organisation/invite/${invitation.token}?action=decline`);
    await waitForHydration(page, 'button');
    await page.getByRole('button', { name: 'Decline', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Invitation declined', exact: true })).toBeVisible();

    expect(await prisma.user.findUnique({ where: { email: invitation.email } })).toBeNull();
    expect(await prisma.organisationMemberInvite.findUniqueOrThrow({ where: { id: invitation.id } })).toMatchObject({
      status: 'DECLINED',
    });
  });

  test('discards external destinations in confirmation emails and the verification page', async ({ page }) => {
    const { user, team } = await seedUser({ verified: false });
    const unsafeReturnTo = '//example.invalid/untrusted';

    const response = await page.request.post('/api/auth/email-password/resend-verify-email', {
      headers: WEBAPP_ORIGIN_HEADERS,
      data: { email: user.email, returnTo: unsafeReturnTo },
    });
    expect(response.ok()).toBe(true);

    const confirmation = await waitForConfirmationEmail(page.request, user.email);
    expect(confirmation.url.origin).toBe(new URL(NEXT_PUBLIC_WEBAPP_URL()).origin);
    expect(confirmation.url.searchParams.has('returnTo')).toBe(false);

    // Tampering with the emailed link must not turn successful verification into an open redirect.
    confirmation.url.searchParams.set('returnTo', unsafeReturnTo);
    await page.goto(confirmation.url.toString());
    await expect(page.getByRole('heading', { name: 'Email Confirmed!', exact: true })).toBeVisible();
    expect(new URL(page.url()).origin).toBe(new URL(NEXT_PUBLIC_WEBAPP_URL()).origin);
    await page.getByRole('link', { name: 'Continue', exact: true }).click();
    await expect(page).toHaveURL(`/t/${team.url}/documents`);
  });
});

const seedInvitation = async (email?: string) => {
  const { organisation } = await seedUser({ isPersonalOrganisation: false });
  const invitation = await seedOrganisationMemberInvite({ organisationId: organisation.id, email });

  return { invitation, organisation };
};

const expectInvitationPending = async (invitationId: string, organisationId: string, userId: number) => {
  expect(await prisma.organisationMemberInvite.findUniqueOrThrow({ where: { id: invitationId } })).toMatchObject({
    status: 'PENDING',
  });
  expect(await prisma.organisationMember.count({ where: { organisationId, userId } })).toBe(0);
};
