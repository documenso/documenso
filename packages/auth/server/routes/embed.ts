import { setCscBlockingErrorCookie } from '@documenso/ee/server-only/signing/csc/cookies/blocking-error-cookie';
import { setCscSadSessionCookie } from '@documenso/ee/server-only/signing/csc/cookies/sad-session-cookie';
import { setCscServiceSessionCookie } from '@documenso/ee/server-only/signing/csc/cookies/service-session-cookie';
import { formatPath, IS_INSTANCE_CSC_MODE } from '@documenso/lib/constants/app';
import {
  IS_GOOGLE_SSO_ENABLED,
  IS_MICROSOFT_SSO_ENABLED,
  IS_OIDC_SSO_ENABLED,
  isSigninDisabledGlobally,
  isSigninEnabledForProvider,
} from '@documenso/lib/constants/auth';
import { AUTH_HANDOFF_TYPE } from '@documenso/lib/constants/auth-handoff';
import {
  formatEmbedAuthCompleteApiUrl,
  formatEmbedAuthCompletePageUrl,
  ZEmbedPopupAuthCscOptionsSchema,
  ZEmbedPopupAuthProviderSchema,
} from '@documenso/lib/constants/embed-auth';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { createRateLimitMiddleware } from '@documenso/lib/server-only/rate-limit/rate-limit-middleware';
import { embedAuthRedeemRateLimit, embedAuthStartRateLimit } from '@documenso/lib/server-only/rate-limit/rate-limits';
import { logger } from '@documenso/lib/utils/logger';
import { sValidator } from '@hono/standard-validator';
import { generateState } from 'arctic';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { GoogleAuthOptions, MicrosoftAuthOptions, OidcAuthOptions } from '../config';
import { createAuthHandoff } from '../lib/handoff/create-auth-handoff';
import { ZAuthHandoffNonceSchema } from '../lib/handoff/hash-auth-handoff-nonce';
import { recordEmbedAuthFailure } from '../lib/handoff/record-embed-auth-failure';
import { redeemAuthHandoff } from '../lib/handoff/redeem-auth-handoff';
import type { EmbedAuthFlowCookiePayload } from '../lib/session/session-cookies';
import {
  clearEmbedAuthFlowCookie,
  getEmbedAuthFlowCookie,
  setEmbedAuthFlowCookie,
  setEmbedSessionCookie,
} from '../lib/session/session-cookies';
import { getOptionalSession } from '../lib/utils/get-session';
import { handleOAuthAuthorizeUrl } from '../lib/utils/handle-oauth-authorize-url';
import { isEqualSecret } from '../lib/utils/is-equal-secret';
import type { HonoAuthContext } from '../types/context';

const CSC_OAUTH_AUTHORIZE_PATH = '/api/csc/oauth/authorize';

const ZStartEmbedAuthSchema = z.object({
  nonce: ZAuthHandoffNonceSchema,
  provider: ZEmbedPopupAuthProviderSchema,
  csc: ZEmbedPopupAuthCscOptionsSchema.optional(),
});

const ZRedeemAuthHandoffSchema = z.object({
  nonce: ZAuthHandoffNonceSchema,
});

const recordEmbedSessionHandoff = async (
  c: Context<HonoAuthContext>,
  flow: EmbedAuthFlowCookiePayload,
): Promise<boolean> => {
  const { session, user } = await getOptionalSession(c);

  if (!session || !user) {
    return false;
  }

  return await createAuthHandoff({
    nonce: flow.nonce,
    type: AUTH_HANDOFF_TYPE.EMBED_SESSION,
    payload: { userId: user.id, sessionId: session.id },
  })
    .then(() => true)
    .catch((err) => {
      logger.error({
        event: 'auth.embed.handoff_create_failed',
        error: err,
      });

      return false;
    });
};

// Throw instead of letting `sValidator` reply with the raw Zod result, so
// validation failures hit `onError` and share the `AppError` response shape.
const rejectInvalidBody: Parameters<typeof sValidator>[2] = (result) => {
  if (!result.success) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid request body',
      statusCode: 400,
    });
  }
};

export const embedRoute = new Hono<HonoAuthContext>()
  /**
   * Binds the popup's nonce to this browser via a signed cookie plus a per-flow
   * `state`. `/complete` must present the same `state`, so a second popup that
   * overwrites the cookie cannot complete (or receive the identity of) this
   * flow. The nonce itself never appears in a URL.
   */
  .post(
    '/start',
    createRateLimitMiddleware(embedAuthStartRateLimit),
    sValidator('json', ZStartEmbedAuthSchema, rejectInvalidBody),
    async (c) => {
      const { nonce, provider, csc } = c.req.valid('json');

      const state = generateState();

      if (provider === 'csc') {
        if (!IS_INSTANCE_CSC_MODE()) {
          throw new AppError(AppErrorCode.NOT_SETUP, {
            message: 'Provider is not enabled',
            statusCode: 400,
          });
        }

        if (!csc) {
          throw new AppError(AppErrorCode.INVALID_REQUEST, {
            message: 'Missing CSC options',
            statusCode: 400,
          });
        }

        const searchParams = new URLSearchParams(
          match(csc)
            .with({ scope: 'service' }, ({ token }) => ({ scope: 'service', token }))
            .with({ scope: 'credential' }, ({ sessionId }) => ({ scope: 'credential', session: sessionId }))
            .exhaustive(),
        );

        searchParams.set('embed', '1');

        await setEmbedAuthFlowCookie(c, nonce, state);

        return c.json({ redirectUrl: `${formatPath(CSC_OAUTH_AUTHORIZE_PATH)}?${searchParams.toString()}` });
      }

      if (provider === 'account') {
        // Passkeys have no per-provider flag; email/password is gated by its own routes.
        if (isSigninDisabledGlobally()) {
          throw new AppError(AppErrorCode.NOT_SETUP, {
            message: 'Provider is not enabled',
            statusCode: 400,
          });
        }

        await setEmbedAuthFlowCookie(c, nonce, state);

        return c.json({ redirectUrl: null, returnTo: formatEmbedAuthCompleteApiUrl(state) });
      }

      const clientOptions = match(provider)
        .with('google', () =>
          IS_GOOGLE_SSO_ENABLED && isSigninEnabledForProvider('google') ? GoogleAuthOptions : null,
        )
        .with('microsoft', () =>
          IS_MICROSOFT_SSO_ENABLED && isSigninEnabledForProvider('microsoft') ? MicrosoftAuthOptions : null,
        )
        .with('oidc', () => (IS_OIDC_SSO_ENABLED && isSigninEnabledForProvider('oidc') ? OidcAuthOptions : null))
        .exhaustive();

      if (!clientOptions) {
        throw new AppError(AppErrorCode.NOT_SETUP, {
          message: 'Provider is not enabled',
          statusCode: 400,
        });
      }

      await setEmbedAuthFlowCookie(c, nonce, state);

      return await handleOAuthAuthorizeUrl({
        c,
        clientOptions,
        redirectPath: formatEmbedAuthCompleteApiUrl(state),
        state,
      });
    },
  )
  /**
   * On a missing flow or `state` mismatch nothing is recorded: there is no nonce
   * this request is entitled to act on. `csc` never lands here; its callback
   * records the handoff itself.
   */
  .get('/complete', async (c) => {
    const flow = await getEmbedAuthFlowCookie(c);

    clearEmbedAuthFlowCookie(c);

    const state = c.req.query('state');

    if (!flow || !state || !isEqualSecret(flow.state, state)) {
      return c.redirect(formatEmbedAuthCompletePageUrl('error'), 302);
    }

    const isHandoffCreated = await recordEmbedSessionHandoff(c, flow);

    if (!isHandoffCreated) {
      await recordEmbedAuthFailure(flow.nonce, 'session_handoff_not_recorded');

      return c.redirect(formatEmbedAuthCompletePageUrl('error'), 302);
    }

    return c.redirect(formatEmbedAuthCompletePageUrl('ok'), 302);
  })
  /**
   * Called from the cross-site iframe; sets the partitioned cookie matching the
   * handoff type. The ee CSC cookie setters are imported here, not in
   * `lib/handoff/*`, to keep that module free of ee dependencies.
   */
  .post(
    '/redeem',
    createRateLimitMiddleware(embedAuthRedeemRateLimit),
    sValidator('json', ZRedeemAuthHandoffSchema, rejectInvalidBody),
    async (c) => {
      const requestMetadata = c.get('requestMetadata');

      const { nonce } = c.req.valid('json');

      const handoff = await redeemAuthHandoff({
        nonce,
        ipAddress: requestMetadata.ipAddress,
        userAgent: requestMetadata.userAgent,
      });

      if (!handoff) {
        return c.json({ status: 'pending' }, 202);
      }

      if (handoff.type === AUTH_HANDOFF_TYPE.EMBED_FAILED) {
        return c.json({ status: 'failed' } as const, 200);
      }

      await match(handoff)
        .with({ type: AUTH_HANDOFF_TYPE.EMBED_SESSION }, async ({ payload }) =>
          setEmbedSessionCookie(c, payload.sessionToken),
        )
        .with({ type: AUTH_HANDOFF_TYPE.EMBED_CSC_SERVICE }, async ({ payload }) =>
          setCscServiceSessionCookie({
            c,
            recipientToken: payload.recipientToken,
            ttlSeconds: payload.ttlSeconds,
          }),
        )
        .with({ type: AUTH_HANDOFF_TYPE.EMBED_CSC_SAD }, async ({ payload }) =>
          setCscSadSessionCookie({
            c,
            sessionId: payload.sessionId,
            expiresAt: payload.expiresAt,
          }),
        )
        .with({ type: AUTH_HANDOFF_TYPE.EMBED_CSC_BLOCKING_ERROR }, async ({ payload }) =>
          setCscBlockingErrorCookie({
            c,
            payload: {
              code: payload.code,
              recipientToken: payload.recipientToken,
            },
          }),
        )
        .exhaustive();

      return c.json({ status: 'ok' } as const, 200);
    },
  );
