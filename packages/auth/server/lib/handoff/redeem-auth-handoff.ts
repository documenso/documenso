import type {
  TAuthHandoffEmbedCscBlockingErrorPayload,
  TAuthHandoffEmbedCscSadPayload,
} from '@documenso/lib/constants/auth-handoff';
import { AUTH_HANDOFF_TYPE, ZAuthHandoffStoredSchema } from '@documenso/lib/constants/auth-handoff';
import { prisma } from '@documenso/prisma';
import { match } from 'ts-pattern';

import { createSession, generateSessionToken } from '../session/session';
import { getAuthSecret } from '../session/session-cookies';
import { AUTH_HANDOFF_TTL_MS } from './constants';
import { hashAuthHandoffNonce, ZAuthHandoffNonceSchema } from './hash-auth-handoff-nonce';
import { decryptAuthHandoffPayload, encryptAuthHandoffPayload } from './payload-crypto';

export type RedeemAuthHandoffOptions = {
  nonce: string;
  ipAddress?: string;
  userAgent?: string;
};

export type RedeemAuthHandoffResult =
  | {
      type: typeof AUTH_HANDOFF_TYPE.EMBED_SESSION;
      payload: {
        sessionToken: string;
      };
    }
  | {
      type: typeof AUTH_HANDOFF_TYPE.EMBED_CSC_SERVICE;
      payload: {
        recipientToken: string;
        ttlSeconds: number;
      };
    }
  | {
      type: typeof AUTH_HANDOFF_TYPE.EMBED_CSC_SAD;
      payload: TAuthHandoffEmbedCscSadPayload;
    }
  | {
      type: typeof AUTH_HANDOFF_TYPE.EMBED_CSC_BLOCKING_ERROR;
      payload: TAuthHandoffEmbedCscBlockingErrorPayload;
    }
  | {
      type: typeof AUTH_HANDOFF_TYPE.EMBED_FAILED;
    };

const SESSION_CLAIM_MAX_RETRIES = 1;

/**
 * Redeem is intentionally NOT one-time: some browsers (older Safari) drop the
 * first `Set-Cookie` from within an iframe and the embed must retry after
 * `requestStorageAccess()`. `EMBED_SESSION` mints a session on first redeem and
 * writes the token back into the encrypted payload for subsequent redeems.
 */
export const redeemAuthHandoff = async ({
  nonce,
  ipAddress,
  userAgent,
}: RedeemAuthHandoffOptions): Promise<RedeemAuthHandoffResult | null> => {
  const parsedNonce = ZAuthHandoffNonceSchema.safeParse(nonce);

  if (!parsedNonce.success) {
    return null;
  }

  const id = hashAuthHandoffNonce(parsedNonce.data);

  return await redeemAuthHandoffById({ id, ipAddress, userAgent, retriesLeft: SESSION_CLAIM_MAX_RETRIES });
};

type RedeemAuthHandoffByIdOptions = {
  id: string;
  ipAddress?: string;
  userAgent?: string;
  retriesLeft: number;
};

const redeemAuthHandoffById = async ({
  id,
  ipAddress,
  userAgent,
  retriesLeft,
}: RedeemAuthHandoffByIdOptions): Promise<RedeemAuthHandoffResult | null> => {
  const row = await prisma.authHandoff.findUnique({
    where: {
      id,
    },
  });

  if (!row) {
    return null;
  }

  if (row.expiresAt.getTime() <= Date.now()) {
    await prisma.authHandoff.deleteMany({
      where: {
        id,
      },
    });

    return null;
  }

  const authSecret = getAuthSecret();

  const parsed = ZAuthHandoffStoredSchema.safeParse({
    type: row.type,
    payload: decryptAuthHandoffPayload({
      secret: authSecret,
      id,
      type: row.type,
      encryptedPayload: row.payload,
    }),
  });

  if (!parsed.success) {
    return null;
  }

  const handoff = parsed.data;

  return match(handoff)
    .with({ type: AUTH_HANDOFF_TYPE.EMBED_SESSION }, async ({ payload }) => {
      if (payload.sessionToken) {
        return {
          type: AUTH_HANDOFF_TYPE.EMBED_SESSION,
          payload: { sessionToken: payload.sessionToken },
        };
      }

      // The handoff must not outlive the top-level session that produced it.
      const originatingSession = await prisma.session.findFirst({
        where: {
          id: payload.sessionId,
          expiresAt: {
            gt: new Date(),
          },
        },
        select: {
          id: true,
        },
      });

      if (!originatingSession) {
        await prisma.authHandoff.deleteMany({
          where: {
            id,
          },
        });

        return null;
      }

      const sessionToken = generateSessionToken();

      const claimedPayload = encryptAuthHandoffPayload({
        secret: authSecret,
        id,
        type: AUTH_HANDOFF_TYPE.EMBED_SESSION,
        payload: {
          userId: payload.userId,
          sessionId: payload.sessionId,
          sessionToken,
        },
      });

      // Optimistic claim on the exact ciphertext read so concurrent first-redeems
      // cannot both mint a session. TTL restarts so a Safari storage-access
      // round trip has the full window to redeem again.
      const isClaimed = await prisma.$transaction(async (tx) => {
        const { count } = await tx.authHandoff.updateMany({
          where: {
            id,
            payload: row.payload,
            expiresAt: {
              gt: new Date(),
            },
          },
          data: {
            payload: claimedPayload,
            expiresAt: new Date(Date.now() + AUTH_HANDOFF_TTL_MS),
          },
        });

        if (count === 0) {
          return false;
        }

        await createSession(sessionToken, payload.userId, { ipAddress, userAgent }, { isEmbed: true, tx });

        return true;
      });

      if (isClaimed) {
        return {
          type: AUTH_HANDOFF_TYPE.EMBED_SESSION,
          payload: { sessionToken },
        };
      }

      if (retriesLeft <= 0) {
        return null;
      }

      return redeemAuthHandoffById({ id, ipAddress, userAgent, retriesLeft: retriesLeft - 1 });
    })
    .with({ type: AUTH_HANDOFF_TYPE.EMBED_CSC_SERVICE }, ({ payload }): RedeemAuthHandoffResult => {
      const ttlSeconds = remainingSeconds(payload.expiresAt);

      if (ttlSeconds < 1) {
        return { type: AUTH_HANDOFF_TYPE.EMBED_FAILED };
      }

      return {
        type: AUTH_HANDOFF_TYPE.EMBED_CSC_SERVICE,
        payload: {
          recipientToken: payload.recipientToken,
          ttlSeconds,
        },
      };
    })
    .with({ type: AUTH_HANDOFF_TYPE.EMBED_CSC_SAD }, ({ payload }): RedeemAuthHandoffResult => {
      if (remainingSeconds(payload.expiresAt) < 1) {
        return { type: AUTH_HANDOFF_TYPE.EMBED_FAILED };
      }

      return {
        type: AUTH_HANDOFF_TYPE.EMBED_CSC_SAD,
        payload,
      };
    })
    .with({ type: AUTH_HANDOFF_TYPE.EMBED_CSC_BLOCKING_ERROR }, ({ payload }) => ({
      type: AUTH_HANDOFF_TYPE.EMBED_CSC_BLOCKING_ERROR,
      payload,
    }))
    .with({ type: AUTH_HANDOFF_TYPE.EMBED_FAILED }, () => ({
      type: AUTH_HANDOFF_TYPE.EMBED_FAILED,
    }))
    .exhaustive();
};

const remainingSeconds = (expiresAt: Date): number => {
  return Math.floor((expiresAt.getTime() - Date.now()) / 1000);
};
