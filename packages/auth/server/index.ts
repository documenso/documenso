import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';

import { emailPasswordRoute } from './routes/email-password';
import { googleRoute } from './routes/google';
import { passkeyRoute } from './routes/passkey';
import { sessionRoute } from './routes/session';
import { signOutRoute } from './routes/sign-out';
import type { HonoAuthContext } from './types/context';

// Note: You must chain routes for Hono RPC client to work.
export const auth = new Hono<HonoAuthContext>()
  .use(async (c, next) => {
    c.set('requestMetadata', extractRequestMetadata(c.req.raw));
    await next();
  })
  .route('/', sessionRoute)
  .route('/', signOutRoute)
  .route('/email-password', emailPasswordRoute)
  .route('/passkey', passkeyRoute)
  .route('/google', googleRoute);

/**
 * Handle errors.
 */
auth.onError((err, c) => {
  // Todo Remove
  console.error(`${err}`);

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
