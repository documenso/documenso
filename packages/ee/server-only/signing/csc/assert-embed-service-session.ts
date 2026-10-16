import { IS_INSTANCE_CSC_MODE } from '@documenso/lib/constants/app';
import { isTspEnvelope } from '@documenso/lib/types/signature-level';

import { expiredCscBlockingErrorCookieHeader, readCscBlockingErrorFromRequest } from './cookies/blocking-error-cookie';
import { readCscServiceSessionFromRequest } from './cookies/service-session-cookie';

/**
 * `error.data.type` the embed layout's ErrorBoundary matches on to render
 * `EmbedCscAuthenticationRequired`. Kept as a literal on both sides: the
 * layout is a client module and must not import from `ee/server-only`.
 */
const EMBED_CSC_AUTHENTICATION_REQUIRED_ERROR_TYPE = 'embed-csc-authentication-required';

export type AssertEmbedCscServiceSessionOptions = {
  request: Request;
  token: string;
  envelope: { signatureLevel: string };
  isCompleted: boolean;
  isRejected: boolean;
};

/**
 * Embed counterpart of the CSC branch in the top-level `/sign/{token}` loader.
 *
 * The TSP cannot be framed, so instead of redirecting we throw a 401 JSON
 * `Response` that React Router surfaces as an `ErrorResponse`; the embed
 * layout's ErrorBoundary renders it as `EmbedCscAuthenticationRequired`, which
 * runs the OAuth round trip in a popup.
 *
 * Completed/rejected envelopes skip the check so they still render after the
 * service cookie expires.
 */
export const assertEmbedCscServiceSession = async ({
  request,
  token,
  envelope,
  isCompleted,
  isRejected,
}: AssertEmbedCscServiceSessionOptions): Promise<void> => {
  if (!IS_INSTANCE_CSC_MODE() || !isTspEnvelope(envelope)) {
    return;
  }

  if (isCompleted || isRejected) {
    return;
  }

  const blockingError = await readCscBlockingErrorFromRequest(request);

  if (blockingError && blockingError.recipientToken === token) {
    throw Response.json(
      {
        type: EMBED_CSC_AUTHENTICATION_REQUIRED_ERROR_TYPE,
        token,
        blockedCode: blockingError.code,
      },
      {
        status: 401,
        headers: {
          'Set-Cookie': expiredCscBlockingErrorCookieHeader(),
        },
      },
    );
  }

  const serviceSessionToken = await readCscServiceSessionFromRequest(request);

  if (serviceSessionToken !== token) {
    throw Response.json(
      {
        type: EMBED_CSC_AUTHENTICATION_REQUIRED_ERROR_TYPE,
        token,
      },
      {
        status: 401,
      },
    );
  }
};
