import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import type { Context } from 'hono';
import { deleteCookie, getSignedCookie, setSignedCookie } from 'hono/cookie';
import { z } from 'zod';

import { CSC_OAUTH_FLOW_COOKIE_NAME, cscCookieBaseOptions, getCscCookieSecret } from './shared';

/**
 * `csc_oauth_flow` — single-round-trip carrier across `/api/csc/oauth/authorize`
 * → TSP → `/api/csc/oauth/callback`. Holds the PKCE verifier + state plus the
 * Documenso-side context (`recipientToken`, optional `sessionId`) the
 * callback needs to resume the right signing flow.
 *
 * JSON-encoded inside a single signed cookie; structurally validated on read
 * so a tampered or stale shape can't smuggle bad state into the callback.
 */

const CSC_OAUTH_FLOW_MAX_AGE_SECONDS = 60 * 10; // 10 minutes — matches /api/auth/oauth/* convention.

export const ZCscOAuthFlowPayloadSchema = z.object({
  /** `'service'` for the first round-trip, `'credential'` for the SAD round-trip. */
  scope: z.enum(['service', 'credential']),
  /** Arctic-generated CSRF token; re-validated against `?state` at callback. */
  state: z.string().min(1),
  /** Arctic-generated PKCE verifier (RFC 7636); paired with the URL's `code_challenge`. */
  codeVerifier: z.string().min(1),
  /** Recipient signing token from `/sign/{token}`; threads recipient identity through the round-trip. */
  recipientToken: z.string().min(1),
  /** CSC session id — present only on `credential`-scope flows (set at prep). */
  sessionId: z.string().min(1).optional(),
});

export type TCscOAuthFlowPayload = z.infer<typeof ZCscOAuthFlowPayloadSchema>;

type SetCscOAuthFlowCookieOptions = {
  c: Context;
  payload: TCscOAuthFlowPayload;
};

export const setCscOAuthFlowCookie = async (options: SetCscOAuthFlowCookieOptions): Promise<void> => {
  const { c, payload } = options;

  await setSignedCookie(c, CSC_OAUTH_FLOW_COOKIE_NAME, JSON.stringify(payload), getCscCookieSecret(), {
    ...cscCookieBaseOptions,
    maxAge: CSC_OAUTH_FLOW_MAX_AGE_SECONDS,
  });
};

/**
 * Read + validate the OAuth-flow cookie. Returns `null` when the cookie is
 * absent or the signature is invalid; throws `INVALID_REQUEST` when the
 * payload is structurally bad (signed but malformed JSON / schema mismatch),
 * since that's tamper-shaped, not a normal missing-cookie case.
 */
export const getCscOAuthFlowCookie = async (c: Context): Promise<TCscOAuthFlowPayload | null> => {
  const raw = await getSignedCookie(c, getCscCookieSecret(), CSC_OAUTH_FLOW_COOKIE_NAME);

  if (!raw) {
    return null;
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(raw);
  } catch {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'CSC OAuth flow cookie payload is not valid JSON.',
    });
  }

  const result = ZCscOAuthFlowPayloadSchema.safeParse(parsedJson);

  if (!result.success) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'CSC OAuth flow cookie payload failed schema validation.',
    });
  }

  return result.data;
};

export const clearCscOAuthFlowCookie = (c: Context): void => {
  deleteCookie(c, CSC_OAUTH_FLOW_COOKIE_NAME, cscCookieBaseOptions);
};
