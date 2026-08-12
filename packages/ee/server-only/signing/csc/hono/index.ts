import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

import type { HonoCscEnv } from './context';
import { cscOAuthAuthorizeRoute } from './oauth-authorize';
import { cscOAuthCallbackRoute } from './oauth-callback';

/**
 * `@documenso/ee` CSC subapp. Mount under `/api/csc` in the remix host (see
 * `apps/remix/server/router.ts`). All CSC endpoints — OAuth authorize +
 * callback — are composed here so the host only has to wire one route.
 *
 * Routes throw `AppError` freely; the `.onError` handler below normalises
 * them into REST responses (mirrors `@documenso/auth/server`'s pattern).
 */
export const csc = new Hono<HonoCscEnv>()
  .route('/oauth/authorize', cscOAuthAuthorizeRoute)
  .route('/oauth/callback', cscOAuthCallbackRoute);

csc.onError((err, c) => {
  const logger = c.get('logger');

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
    const { status, body } = AppError.toRestAPIError(err);

    logger.error({
      event: 'csc.error',
      code: err.code,
      message: err.message,
    });

    return c.json(body, status as ContentfulStatusCode);
  }

  logger.error({
    event: 'csc.unknown_error',
    error: err,
  });

  return c.json(
    {
      code: AppErrorCode.UNKNOWN_ERROR,
      message: 'Internal Server Error',
      statusCode: 500,
    },
    500,
  );
});

export type CscAppType = typeof csc;
