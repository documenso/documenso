import { createAuthHandoff } from '@documenso/auth/server/lib/handoff/create-auth-handoff';
import { hashAuthHandoffNonce } from '@documenso/auth/server/lib/handoff/hash-auth-handoff-nonce';
import { recordEmbedAuthFailure } from '@documenso/auth/server/lib/handoff/record-embed-auth-failure';
import { clearEmbedAuthFlowCookie, getEmbedAuthFlowCookie } from '@documenso/auth/server/lib/session/session-cookies';
import type { TAuthHandoffCreate } from '@documenso/lib/constants/auth-handoff';
import { AUTH_HANDOFF_TYPE } from '@documenso/lib/constants/auth-handoff';
import { formatEmbedAuthCompletePageUrl } from '@documenso/lib/constants/embed-auth';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import { extractRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { formatSigningLink } from '@documenso/lib/utils/recipients';
import { prisma } from '@documenso/prisma';
import { sValidator } from '@hono/standard-validator';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import { resolveCscAlgorithmPolicy } from '../algorithm-resolver';
import { encodeCscCertChain } from '../cert-chain';
import { encryptCscToken } from '../ciphers';
import { cscCredentialsInfo, cscCredentialsList } from '../client/credentials';
import { exchangeCscAuthorizationCode } from '../client/oauth';
import { setCscBlockingErrorCookie } from '../cookies/blocking-error-cookie';
import type { TCscOAuthFlowPayload } from '../cookies/oauth-flow-cookie';
import { clearCscOAuthFlowCookie, getCscOAuthFlowCookie } from '../cookies/oauth-flow-cookie';
import { setCscSadSessionCookie } from '../cookies/sad-session-cookie';
import { setCscServiceSessionCookie } from '../cookies/service-session-cookie';
import { loadCscCredential, upsertCscCredential } from '../credential';
import { updateCscSessionWithSad } from '../sign-session';
import { getCscTransport } from '../transport';
import type { HonoCscEnv } from './context';

/**
 * `GET /api/csc/oauth/callback` — landing point for the recipient's return
 * from the TSP after the round-trip initiated by `oauth-authorize`. Reads
 * the `csc_oauth_flow` cookie, verifies CSRF, exchanges the code, and
 * branches on the cookie's `scope`:
 *
 * - `service`: pulls `credentials/list` + `credentials/info`, validates the
 *   cert + algorithm policy, persists the `CscCredential` row + service
 *   token, sets the `csc_service_session` cookie, and redirects to
 *   `/sign/{token}`. Blocking validation errors (empty list, bad cert,
 *   refused algorithm) round-trip via the `csc_blocking_error` cookie so the
 *   signing-page loader can render a stable error UI.
 * - `credential`: exchanges code → SAD, stamps it onto the existing
 *   `CscSession`, sets the `csc_sad_session` cookie, and redirects to
 *   `/sign/{token}`. Credential-scope failures bubble to `.onError` — the
 *   recipient simply re-clicks Sign.
 *
 * Non-blocking errors bubble to the parent app's `.onError` (see
 * `./index.ts`) — mirrors `oauth-authorize.ts`.
 *
 * Embed variant (`cookie.embedNonceHash` set): the popup's cookies are invisible
 * to the cross-site iframe, so every cookie-borne outcome is also recorded as an
 * auth handoff for the iframe to redeem. Cookies are still set so a top-level
 * retry keeps working.
 */

const ZCallbackQuerySchema = z.object({
  state: z.string().min(1),
  code: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
  error_description: z.string().optional(),
});

const BLOCKING_SERVICE_ERROR_CODES = new Set<string>([
  AppErrorCode.CSC_CREDENTIAL_LIST_EMPTY,
  AppErrorCode.CSC_CERT_INVALID,
  AppErrorCode.CSC_ALGORITHM_REFUSED,
]);

const isBlockingServiceError = (code: string): boolean => BLOCKING_SERVICE_ERROR_CODES.has(code);

export const cscOAuthCallbackRoute = new Hono<HonoCscEnv>().get(
  '/',
  sValidator('query', ZCallbackQuerySchema),
  async (c) => {
    const logger = c.get('logger');

    const query = c.req.valid('query');

    const cookie = await getCscOAuthFlowCookie(c);

    if (!cookie) {
      throw new AppError(AppErrorCode.INVALID_REQUEST, {
        message: 'CSC OAuth flow cookie missing or expired.',
      });
    }

    if (query.state !== cookie.state) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'CSC OAuth callback state mismatch — possible CSRF.',
      });
    }

    // The single-round-trip carrier is spent regardless of subsequent
    // outcome; clear it now so a retry restarts from `/api/csc/oauth/authorize`.
    clearCscOAuthFlowCookie(c);

    // The flow cookie must be the one the authorize route saw; a different nonce
    // means this round trip belongs to another embed attempt.
    let embedNonce: string | null = null;

    if (cookie.embedNonceHash !== undefined) {
      const embedFlow = await getEmbedAuthFlowCookie(c);

      clearEmbedAuthFlowCookie(c);

      const isEmbedFlowBound = embedFlow !== null && hashAuthHandoffNonce(embedFlow.nonce) === cookie.embedNonceHash;

      if (!isEmbedFlowBound) {
        logger.warn({
          event: 'csc.oauth.callback.embed.flow_missing',
          scope: cookie.scope,
          reason: embedFlow === null ? 'missing' : 'nonce_mismatch',
        });

        return c.redirect(formatEmbedAuthCompletePageUrl('error'), 302);
      }

      embedNonce = embedFlow.nonce;
    }

    const embedOutcome: EmbedOutcome = { isRecorded: false };

    try {
      return await completeCscCallback({ c, query, cookie, embedNonce, embedOutcome });
    } catch (err) {
      // An error after the outcome handoff exists must not overwrite it.
      if (!embedNonce || embedOutcome.isRecorded) {
        throw err;
      }

      logger.error({
        event: 'csc.oauth.callback.embed.failed',
        scope: cookie.scope,
        code: err instanceof AppError ? err.code : AppErrorCode.UNKNOWN_ERROR,
        error: err,
      });

      await recordEmbedAuthFailure(embedNonce, 'csc_callback_failed');

      return c.redirect(formatEmbedAuthCompletePageUrl('error'), 302);
    }
  },
);

type EmbedOutcome = {
  isRecorded: boolean;
};

type CompleteCscCallbackOptions = {
  c: Context<HonoCscEnv>;
  query: z.infer<typeof ZCallbackQuerySchema>;
  cookie: TCscOAuthFlowPayload;
  embedNonce: string | null;
  embedOutcome: EmbedOutcome;
};

const completeCscCallback = async ({ c, query, cookie, embedNonce, embedOutcome }: CompleteCscCallbackOptions) => {
  const logger = c.get('logger');

  const isEmbed = embedNonce !== null;

  const resolveRedirectUrl = () =>
    isEmbed ? formatEmbedAuthCompletePageUrl('ok') : formatSigningLink(cookie.recipientToken);

  const recordEmbedHandoff = async (handoff: TAuthHandoffCreate): Promise<boolean> => {
    if (!embedNonce) {
      return true;
    }

    try {
      await createAuthHandoff({ nonce: embedNonce, ...handoff });

      embedOutcome.isRecorded = true;

      return true;
    } catch (err) {
      logger.error({
        event: 'csc.oauth.callback.embed.handoff_failed',
        scope: cookie.scope,
        type: handoff.type,
        error: err,
      });

      return false;
    }
  };

  const redirectEmbedFailure = async () => {
    if (embedNonce) {
      await recordEmbedAuthFailure(embedNonce, 'csc_handoff_not_recorded');
    }

    return c.redirect(formatEmbedAuthCompletePageUrl('error'), 302);
  };

  if (query.error) {
    throw new AppError(AppErrorCode.CSC_REQUEST_FAILED, {
      message: `CSC TSP returned OAuth error: ${query.error}${query.error_description ? ' — ' + query.error_description : ''}`,
    });
  }

  if (!query.code) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'CSC OAuth callback missing code parameter.',
    });
  }

  const transport = await getCscTransport();

  const recipient = await getRecipientByToken({ token: cookie.recipientToken }).catch(() => null);

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found for CSC OAuth flow cookie.',
    });
  }

  if (cookie.scope === 'service') {
    const tokens = await exchangeCscAuthorizationCode({
      client: transport.oauthClient,
      oauthBaseUrl: transport.oauthBaseUrl,
      code: query.code,
      codeVerifier: cookie.codeVerifier,
    });

    try {
      const listResp = await cscCredentialsList({
        baseUrl: transport.serviceBaseUrl,
        accessToken: tokens.accessToken(),
      });

      // V1 picks the first credential per spec section "Out of scope for
      // V1": multi-credential selection UI lands in a later iteration.
      const credentialId = listResp.credentialIDs[0];

      const infoResp = await cscCredentialsInfo({
        baseUrl: transport.serviceBaseUrl,
        accessToken: tokens.accessToken(),
        credentialID: credentialId,
        certificates: 'chain',
        certInfo: true,
      });

      const policy = resolveCscAlgorithmPolicy(infoResp);

      if (!infoResp.cert.certificates || infoResp.cert.certificates.length === 0) {
        throw new AppError(AppErrorCode.CSC_CERT_INVALID, {
          message: 'CSC credential info response omitted required certificate chain.',
        });
      }

      const certCache = encodeCscCertChain(infoResp.cert.certificates);
      const serviceTokenCiphertext = encryptCscToken(tokens.accessToken());
      const serviceTokenExpiresAt = tokens.accessTokenExpiresAt();

      await upsertCscCredential({
        recipientId: recipient.id,
        providerId: transport.serviceBaseUrl,
        credentialId,
        certCache,
        signatureAlgorithm: policy.signAlgoOid,
        keyType: policy.keyType,
        digestAlgorithm: policy.digestAlgorithm,
        keyLenBits: policy.keyLenBits,
        serviceTokenCiphertext,
        serviceTokenExpiresAt,
      });

      await setCscServiceSessionCookie({
        c,
        recipientToken: cookie.recipientToken,
        ttlSeconds: tokens.accessTokenExpiresInSeconds(),
      });

      const isServiceHandoffRecorded = await recordEmbedHandoff({
        type: AUTH_HANDOFF_TYPE.EMBED_CSC_SERVICE,
        payload: {
          recipientToken: cookie.recipientToken,
          expiresAt: serviceTokenExpiresAt,
        },
      });

      if (!isServiceHandoffRecorded) {
        return await redirectEmbedFailure();
      }

      await prisma.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_CSC_AUTHENTICATED,
          envelopeId: recipient.envelopeId,
          user: { name: recipient.name, email: recipient.email },
          requestMetadata: extractRequestMetadata(c.req.raw),
          data: {
            recipientEmail: recipient.email,
            recipientName: recipient.name,
            recipientId: recipient.id,
            recipientRole: recipient.role,
            providerId: transport.serviceBaseUrl,
            credentialId,
            signatureAlgorithm: policy.signAlgoOid,
            digestAlgorithm: policy.digestAlgorithm,
          },
        }),
      });

      logger.info({
        event: 'csc.oauth.callback.service.complete',
        recipientId: recipient.id,
        embed: isEmbed,
      });

      return c.redirect(resolveRedirectUrl(), 302);
    } catch (err) {
      if (err instanceof AppError && isBlockingServiceError(err.code)) {
        await setCscBlockingErrorCookie({
          c,
          payload: { code: err.code, recipientToken: cookie.recipientToken },
        });

        // A blocking error is a completed flow from the popup's view, hence `ok`.
        const isBlockingHandoffRecorded = await recordEmbedHandoff({
          type: AUTH_HANDOFF_TYPE.EMBED_CSC_BLOCKING_ERROR,
          payload: { code: err.code, recipientToken: cookie.recipientToken },
        });

        if (!isBlockingHandoffRecorded) {
          return await redirectEmbedFailure();
        }

        await prisma.documentAuditLog.create({
          data: createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_CSC_AUTHENTICATION_FAILED,
            envelopeId: recipient.envelopeId,
            user: { name: recipient.name, email: recipient.email },
            requestMetadata: extractRequestMetadata(c.req.raw),
            data: {
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              recipientId: recipient.id,
              recipientRole: recipient.role,
              providerId: transport.serviceBaseUrl,
              reason: err.code,
            },
          }),
        });

        logger.warn({
          event: 'csc.oauth.callback.service.blocking',
          recipientId: recipient.id,
          code: err.code,
          embed: isEmbed,
        });

        return c.redirect(resolveRedirectUrl(), 302);
      }

      throw err;
    }
  }

  if (!cookie.sessionId) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'CSC credential-scope OAuth callback missing sessionId in cookie.',
    });
  }

  const tokens = await exchangeCscAuthorizationCode({
    client: transport.oauthClient,
    oauthBaseUrl: transport.oauthBaseUrl,
    code: query.code,
    codeVerifier: cookie.codeVerifier,
  });

  // CSC §8.3.3 says credential-scope returns `token_type === 'SAD'`. We
  // don't hard-fail on a divergent label — the binding is by scope + hash,
  // not by `token_type` — but we log so operator metrics can spot loose
  // TSPs.
  if (tokens.tokenType() !== 'SAD') {
    logger.warn({
      event: 'csc.oauth.callback.credential.unexpected_token_type',
      actual: tokens.tokenType(),
    });
  }

  const sadCiphertext = encryptCscToken(tokens.accessToken());
  const sadExpiresAt = tokens.accessTokenExpiresAt();

  await updateCscSessionWithSad({
    sessionId: cookie.sessionId,
    encryptedSad: sadCiphertext,
    sadExpiresAt,
  });

  await setCscSadSessionCookie({
    c,
    sessionId: cookie.sessionId,
    expiresAt: sadExpiresAt,
  });

  const isSadHandoffRecorded = await recordEmbedHandoff({
    type: AUTH_HANDOFF_TYPE.EMBED_CSC_SAD,
    payload: {
      sessionId: cookie.sessionId,
      expiresAt: sadExpiresAt,
    },
  });

  if (!isSadHandoffRecorded) {
    return await redirectEmbedFailure();
  }

  const credential = await loadCscCredential(recipient.id);

  if (!credential) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'CSC credential missing at credential-scope callback.',
    });
  }

  await prisma.documentAuditLog.create({
    data: createDocumentAuditLogData({
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_RECIPIENT_CSC_AUTHORIZED,
      envelopeId: recipient.envelopeId,
      user: { name: recipient.name, email: recipient.email },
      requestMetadata: extractRequestMetadata(c.req.raw),
      data: {
        recipientEmail: recipient.email,
        recipientName: recipient.name,
        recipientId: recipient.id,
        recipientRole: recipient.role,
        providerId: credential.providerId,
        credentialId: credential.credentialId,
        sessionId: cookie.sessionId,
        sadExpiresAt,
      },
    }),
  });

  logger.info({
    event: 'csc.oauth.callback.credential.complete',
    recipientId: recipient.id,
    sessionId: cookie.sessionId,
    embed: isEmbed,
  });

  return c.redirect(resolveRedirectUrl(), 302);
};
