import { AppError } from '@documenso/lib/errors/app-error';
import { validateTwoFactorAuthentication } from '@documenso/lib/server-only/2fa/validate-2fa';
import { prisma } from '@documenso/prisma';
import { Hono } from 'hono';

import { GoogleAuthOptions, MicrosoftAuthOptions, OidcAuthOptions } from '../config';
import { deleteOAuth2faPendingCookie, getOAuth2faPendingCookie } from '../lib/session/session-cookies';
import { onAuthorize } from '../lib/utils/authorizer';
import { handleOAuthCallbackUrl } from '../lib/utils/handle-oauth-callback-url';
import { handleOAuthOrganisationCallbackUrl } from '../lib/utils/handle-oauth-organisation-callback-url';
import type { HonoAuthContext } from '../types/context';

/**
 * Have to create this route instead of bundling callback with oauth routes to provide
 * backwards compatibility for self-hosters (since we used to use NextAuth).
 */
export const callbackRoute = new Hono<HonoAuthContext>()
  /**
   * OIDC callback verification.
   */
  .get('/oidc', async (c) => handleOAuthCallbackUrl({ c, clientOptions: OidcAuthOptions }))

  /**
   * Organisation OIDC callback verification.
   */
  .get('/oidc/org/:orgUrl', async (c) => {
    const orgUrl = c.req.param('orgUrl');

    try {
      return await handleOAuthOrganisationCallbackUrl({
        c,
        orgUrl,
      });
    } catch (err) {
      console.error(err);

      if (err instanceof Error) {
        throw new AppError(err.name, {
          message: err.message,
          statusCode: 500,
        });
      }

      throw err;
    }
  })

  /**
   * Google callback verification.
   */
  .get('/google', async (c) => handleOAuthCallbackUrl({ c, clientOptions: GoogleAuthOptions }))

  /**
   * Microsoft callback verification.
   */
  .get('/microsoft', async (c) => handleOAuthCallbackUrl({ c, clientOptions: MicrosoftAuthOptions }))

  /**
   * Renders the 2FA verify form for OAuth pending logins.
   */
  .get('/oauth/2fa', async (c) => {
    const pending = await getOAuth2faPendingCookie(c);

    if (!pending) {
      return c.redirect('/signin', 302);
    }

    return c.html(renderOAuth2faForm());
  })

  /**
   * Processes the 2FA verification code.
   */
  .post('/oauth/2fa', async (c) => {
    const pending = await getOAuth2faPendingCookie(c);

    if (!pending) {
      return c.redirect('/signin', 302);
    }

    const body = await c.req.parseBody();
    const totpCode = body.totpCode;

    const user = await prisma.user.findFirst({
      where: { id: pending.userId },
      select: {
        id: true,
        email: true,
        twoFactorEnabled: true,
        twoFactorSecret: true,
        twoFactorBackupCodes: true,
      },
    });

    if (!user) {
      await deleteOAuth2faPendingCookie(c);
      return c.redirect('/signin', 302);
    }

    try {
      const isValid = await validateTwoFactorAuthentication({
        totpCode: typeof totpCode === 'string' ? totpCode : undefined,
        user,
      });

      if (!isValid) {
        return c.html(renderOAuth2faForm('The two-factor authentication code provided is incorrect.'));
      }

      // Success! Create the active session and redirect the user
      await deleteOAuth2faPendingCookie(c);
      await onAuthorize({ userId: user.id }, c);

      return c.redirect(pending.redirectPath || '/', 302);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'The two-factor authentication code provided is incorrect.';
      return c.html(renderOAuth2faForm(errorMsg));
    }
  });

const renderOAuth2faForm = (error?: string) => {
  const errorAlert = error
    ? `<div class="mb-4 p-3 bg-red-950/50 border border-red-500/50 rounded-xl text-red-200 text-sm text-center">${error}</div>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Two-Factor Authentication Required</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Outfit', sans-serif;
    }
  </style>
</head>
<body class="bg-[#0b0c10] text-[#c5c6c7] flex items-center justify-center min-h-screen">
  <div class="w-full max-w-md p-8 bg-[#1f2833] rounded-2xl border border-white/10 shadow-2xl">
    <div class="text-center mb-6">
      <h1 class="text-2xl font-bold text-white tracking-wide">Two-Factor Authentication</h1>
      <p class="text-sm text-gray-400 mt-2">Please enter the 6-digit verification code from your authenticator app to complete sign in.</p>
    </div>
    
    ${errorAlert}
    
    <form method="POST" action="/api/auth/callback/oauth/2fa" class="space-y-6">
      <div>
        <label for="totpCode" class="block text-xs font-semibold uppercase tracking-wider text-gray-400 mb-2">Verification Code</label>
        <input type="text" id="totpCode" name="totpCode" pattern="[0-9]{6}" inputmode="numeric" autocomplete="one-time-code" required placeholder="123456" autofocus
               class="w-full text-center tracking-[1em] pl-[1.5em] py-4 bg-[#0b0c10] border border-gray-700 rounded-xl text-white font-mono text-2xl focus:outline-none focus:border-white transition-all">
      </div>
      
      <button type="submit" 
              class="w-full py-4 bg-white text-black font-semibold rounded-xl hover:bg-white/90 active:scale-[0.98] transition-all flex items-center justify-center gap-2">
        Verify & Sign In
      </button>
    </form>
    
    <div class="text-center mt-6">
      <a href="/signin" class="text-xs text-gray-500 hover:text-gray-400 transition-all">Cancel and return to Sign In</a>
    </div>
  </div>
</body>
</html>
`;
};
