import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { rejectEmbedSessionMiddleware } from './lib/session/embed-session-restrictions';
import { setCsrfCookie } from './lib/session/session-cookies';
import { accountRoute } from './routes/account';
import { callbackRoute } from './routes/callback';
import { emailPasswordRoute } from './routes/email-password';
import { embedRoute } from './routes/embed';
import { oauthRoute } from './routes/oauth';
import { passkeyRoute } from './routes/passkey';
import { sessionRoute } from './routes/session';
import { signOutRoute } from './routes/sign-out';
import { twoFactorRoute } from './routes/two-factor';
import type { HonoAuthContext } from './types/context';

// Note: You must chain routes for Hono RPC client to work.
export const auth = new Hono<HonoAuthContext>()
  .use(async (c, next) => {
    c.set('requestMetadata', extractRequestMetadata(c.req.raw));

    await next();
  })
  .use('/accounts', rejectEmbedSessionMiddleware)
  .use('/account/*', rejectEmbedSessionMiddleware)
  .use('/email-password/update-password', rejectEmbedSessionMiddleware)
  .use('/email-password/2fa/*', rejectEmbedSessionMiddleware)
  .use('/two-factor/*', rejectEmbedSessionMiddleware)
  .get('/csrf', async (c) => {
    const csrfToken = await setCsrfCookie(c);

    return c.json({ csrfToken });
  })
  .route('/', sessionRoute)
  .route('/', signOutRoute)
  .route('/', accountRoute)
  .route('/callback', callbackRoute)
  .route('/oauth', oauthRoute)
  .route('/email-password', emailPasswordRoute)
  .route('/embed', embedRoute)
  .route('/passkey', passkeyRoute)
  .route('/two-factor', twoFactorRoute);

/**
 * Handle errors.
 */
auth.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json(
      {
        code: AppErrorCode.UNKNOWN_ERROR,
        message: err.message,
        statusCode: err.status,
      },
      err.status,
    );
  }

  if (err instanceof AppError) {
    // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
    const statusCode = (err.statusCode || 500) as ContentfulStatusCode;

    return c.json(
      {
        code: err.code,
        message: err.message,
        statusCode: err.statusCode,
      },
      statusCode,
    );
  }

  // Handle other errors
  console.error('Unknown Error:', err);
  return c.json(
    {
      code: AppErrorCode.UNKNOWN_ERROR,
      message: 'Internal Server Error',
      statusCode: 500,
    },
    500,
  );
});

export type AuthAppType = typeof auth;
