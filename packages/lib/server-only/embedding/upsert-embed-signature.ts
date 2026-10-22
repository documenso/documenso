import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { createEmbedSignatureKey } from './create-embed-signature-key';

// `clientUserId` is caller-chosen, so without this a single recipient token
// could mint unlimited rows by cycling identifiers. Best-effort under
// concurrency; the rate limit bounds any overshoot.
export const EMBED_SIGNATURES_PER_RECIPIENT_LIMIT = 5;

export type UpsertEmbedSignatureOptions = {
  organisationId: string;
  recipientId: number;
  email: string;
  clientUserId: string;
  signature: string;
};

export const upsertEmbedSignature = async ({
  organisationId,
  recipientId,
  email,
  clientUserId,
  signature,
}: UpsertEmbedSignatureOptions) => {
  const key = createEmbedSignatureKey({ organisationId, email, clientUserId });

  await prisma.$transaction(async (tx) => {
    const existing = await tx.embedSignature.findUnique({
      where: {
        key,
      },
      select: {
        key: true,
      },
    });

    if (!existing) {
      const count = await tx.embedSignature.count({
        where: {
          recipientId,
        },
      });

      if (count >= EMBED_SIGNATURES_PER_RECIPIENT_LIMIT) {
        throw new AppError(AppErrorCode.LIMIT_EXCEEDED, {
          message: 'Too many persisted signatures for this recipient',
        });
      }
    }

    await tx.embedSignature.upsert({
      where: {
        key,
      },
      create: {
        key,
        organisationId,
        recipientId,
        signature,
      },
      update: {
        recipientId,
        signature,
      },
    });
  });
};
