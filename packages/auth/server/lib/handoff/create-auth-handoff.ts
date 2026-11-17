import type { TAuthHandoffCreate } from '@documenso/lib/constants/auth-handoff';
import { ZAuthHandoffCreateSchema } from '@documenso/lib/constants/auth-handoff';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { prisma } from '@documenso/prisma';

import { getAuthSecret } from '../session/session-cookies';
import { AUTH_HANDOFF_TTL_MS } from './constants';
import { hashAuthHandoffNonce, ZAuthHandoffNonceSchema } from './hash-auth-handoff-nonce';
import { encryptAuthHandoffPayload } from './payload-crypto';

export type CreateAuthHandoffOptions = TAuthHandoffCreate & {
  nonce: string;
};

// Upserted so a retried flow overwrites the previous handoff for the nonce.
export const createAuthHandoff = async ({ nonce, type, payload }: CreateAuthHandoffOptions) => {
  const parsedNonce = ZAuthHandoffNonceSchema.safeParse(nonce);

  if (!parsedNonce.success) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid auth handoff nonce',
    });
  }

  const parsedHandoff = ZAuthHandoffCreateSchema.safeParse({ type, payload });

  if (!parsedHandoff.success) {
    throw new AppError(AppErrorCode.INVALID_REQUEST, {
      message: 'Invalid auth handoff payload',
    });
  }

  const id = hashAuthHandoffNonce(parsedNonce.data);

  const encryptedPayload = encryptAuthHandoffPayload({
    secret: getAuthSecret(),
    id,
    type: parsedHandoff.data.type,
    payload: parsedHandoff.data.payload,
  });

  const expiresAt = new Date(Date.now() + AUTH_HANDOFF_TTL_MS);

  await prisma.authHandoff.upsert({
    where: {
      id,
    },
    create: {
      id,
      type: parsedHandoff.data.type,
      payload: encryptedPayload,
      expiresAt,
    },
    update: {
      type: parsedHandoff.data.type,
      payload: encryptedPayload,
      createdAt: new Date(),
      expiresAt,
    },
  });
};
