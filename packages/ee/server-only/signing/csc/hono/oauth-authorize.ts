import { hashAuthHandoffNonce } from '@documenso/auth/server/lib/handoff/hash-auth-handoff-nonce';
import { recordEmbedAuthFailure } from '@documenso/auth/server/lib/handoff/record-embed-auth-failure';
import { getEmbedAuthFlowCookie } from '@documenso/auth/server/lib/session/session-cookies';
import { formatEmbedAuthCompletePageUrl } from '@documenso/lib/constants/embed-auth';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getRecipientByToken } from '@documenso/lib/server-only/recipient/get-recipient-by-token';
import { prisma } from '@documenso/prisma';
import { sValidator } from '@hono/standard-validator';
import type { Context } from 'hono';
import { Hono } from 'hono';
import { z } from 'zod';

import {
  buildCscCredentialScopeAuthorizeUrl,
  buildCscServiceScopeAuthorizeUrl,
  generateCodeVerifier,
  generateState,
} from '../client/oauth';
import { setCscOAuthFlowCookie } from '../cookies/oauth-flow-cookie';
import { loadCscCredential } from '../credential';
import { loadCscSession } from '../sign-session';
import { getCscTransport } from '../transport';
import type { HonoCscEnv } from './context';

/**
 * `GET /api/csc/oauth/authorize` — initiates the CSC OAuth round-trip and
 * 302-redirects to the TSP's authorize URL with a signed `csc_oauth_flow`
 * cookie carrying the state, PKCE verifier, and recipient context the
 * callback needs to resume the flow.
 *
 * Branches on `?scope=service|credential`:
 * - `service`: authorised by recipient token; precedes credentials/list.
 * - `credential`: authorised by an active `CscSession`; binds the issued SAD
 *   to the per-item hashes captured at prep.
 *
 * `?embed=1` marks a round-trip started from the embed auth popup; the callback
 * then hands the resulting cookie to the iframe instead of redirecting.
 *
 * Errors bubble to the parent app's `.onError` handler (see `./index.ts`),
 * except for embed round-trips, which fail the embed flow instead.
 */

const ZEmbedFlagSchema = z.literal('1').optional();

const ZAuthorizeQuerySchema = z.union([
  z.object({
    scope: z.literal('service'),
    token: z.string().min(1),
    embed: ZEmbedFlagSchema,
  }),
  z.object({
    scope: z.literal('credential'),
    session: z.string().min(1),
    embed: ZEmbedFlagSchema,
  }),
]);

export const cscOAuthAuthorizeRoute = new Hono<HonoCscEnv>().get(
  '/',
  sValidator('query', ZAuthorizeQuerySchema),
  async (c) => {
    const logger = c.get('logger');

    const query = c.req.valid('query');

    const isEmbed = query.embed === '1';

    let embedNonce: string | undefined;

    if (isEmbed) {
      const embedFlow = await getEmbedAuthFlowCookie(c);

      if (!embedFlow) {
        logger.warn({
          event: 'csc.oauth.authorize.embed.flow_missing',
          scope: query.scope,
        });

        return c.redirect(formatEmbedAuthCompletePageUrl('error'), 302);
      }

      embedNonce = embedFlow.nonce;
    }

    try {
      return await startCscAuthorize({ c, query, embedNonce });
    } catch (err) {
      if (!embedNonce) {
        throw err;
      }

      logger.error({
        event: 'csc.oauth.authorize.embed.failed',
        scope: query.scope,
        code: err instanceof AppError ? err.code : AppErrorCode.UNKNOWN_ERROR,
        error: err,
      });

      await recordEmbedAuthFailure(embedNonce, 'csc_authorize_failed');

      return c.redirect(formatEmbedAuthCompletePageUrl('error'), 302);
    }
  },
);

type StartCscAuthorizeOptions = {
  c: Context<HonoCscEnv>;
  query: z.infer<typeof ZAuthorizeQuerySchema>;
  embedNonce: string | undefined;
};

const startCscAuthorize = async ({ c, query, embedNonce }: StartCscAuthorizeOptions) => {
  const logger = c.get('logger');

  const isEmbed = embedNonce !== undefined;

  const embedNonceHash = embedNonce !== undefined ? hashAuthHandoffNonce(embedNonce) : undefined;

  const transport = await getCscTransport();

  if (query.scope === 'service') {
    const recipient = await getRecipientByToken({ token: query.token }).catch(() => null);

    if (!recipient) {
      throw new AppError(AppErrorCode.NOT_FOUND, {
        message: 'Recipient not found for the provided token.',
      });
    }

    logger.info({
      event: 'csc.oauth.authorize.start',
      scope: 'service',
      recipientId: recipient.id,
      embed: isEmbed,
    });

    const state = generateState();
    const codeVerifier = generateCodeVerifier();

    const authorizeUrl = buildCscServiceScopeAuthorizeUrl({
      client: transport.oauthClient,
      oauthBaseUrl: transport.oauthBaseUrl,
      state,
      codeVerifier,
    });

    await setCscOAuthFlowCookie({
      c,
      payload: {
        scope: 'service',
        state,
        codeVerifier,
        recipientToken: query.token,
        embedNonceHash,
      },
    });

    return c.redirect(authorizeUrl.toString(), 302);
  }

  const session = await loadCscSession(query.session);

  if (!session) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'CSC session not found or already consumed.',
    });
  }

  const credential = await loadCscCredential(session.recipientId);

  if (!credential) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'CSC credential missing — service-scope OAuth must complete first.',
    });
  }

  const recipient = await prisma.recipient.findUnique({
    where: { id: session.recipientId },
    select: { token: true },
  });

  if (!recipient) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Recipient not found for the CSC session.',
    });
  }

  logger.info({
    event: 'csc.oauth.authorize.start',
    scope: 'credential',
    recipientId: session.recipientId,
    sessionId: session.id,
    numSignatures: session.items.length,
    embed: isEmbed,
  });

  const state = generateState();
  const codeVerifier = generateCodeVerifier();

  const authorizeUrl = buildCscCredentialScopeAuthorizeUrl({
    client: transport.oauthClient,
    oauthBaseUrl: transport.oauthBaseUrl,
    state,
    codeVerifier,
    credentialId: credential.credentialId,
    numSignatures: session.items.length,
    hashes: session.items.map((item) => item.hashB64),
  });

  await setCscOAuthFlowCookie({
    c,
    payload: {
      scope: 'credential',
      state,
      codeVerifier,
      recipientToken: recipient.token,
      sessionId: session.id,
      embedNonceHash,
    },
  });

  return c.redirect(authorizeUrl.toString(), 302);
};
