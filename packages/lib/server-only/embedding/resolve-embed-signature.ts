import { prisma } from '@documenso/prisma';

import { ZEmbedClientUserIdSchema } from '../../types/embed-signature';
import type { TClaimFlags } from '../../types/subscription';
import { isEmbedSignaturePersistenceEnabled } from '../../utils/billing';
import { logger } from '../../utils/logger';
import { getEmbedSignature } from './get-embed-signature';

export type ResolveEmbedSignatureOptions = {
  clientUserId: string | null | undefined;
  teamId: number;
  recipientEmail: string;
  claimFlags: TClaimFlags;
};

export type ResolvedEmbedSignature = {
  clientUserId: string;
  persistedSignature: string | null;
};

/**
 * Returns `null` when there is no usable `clientUserId` or the organisation
 * isn't entitled, so the client knows not to attempt writes.
 *
 * Never throws: persistence is an enhancement and must not block signing.
 */
export const resolveEmbedSignature = async ({
  clientUserId: rawClientUserId,
  teamId,
  recipientEmail,
  claimFlags,
}: ResolveEmbedSignatureOptions): Promise<ResolvedEmbedSignature | null> => {
  const parsedClientUserId = ZEmbedClientUserIdSchema.safeParse(rawClientUserId);

  if (!parsedClientUserId.success || !isEmbedSignaturePersistenceEnabled(claimFlags)) {
    return null;
  }

  const clientUserId = parsedClientUserId.data;

  try {
    const team = await prisma.team.findFirstOrThrow({
      where: {
        id: teamId,
      },
      select: {
        organisationId: true,
      },
    });

    const persistedSignature = await getEmbedSignature({
      organisationId: team.organisationId,
      email: recipientEmail,
      clientUserId,
    });

    return {
      clientUserId,
      persistedSignature,
    };
  } catch (error) {
    logger.warn({ msg: 'Failed to resolve persisted embed signature', teamId, error });

    return null;
  }
};
