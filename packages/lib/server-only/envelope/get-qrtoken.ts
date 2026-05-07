import { EnvelopeType } from '@prisma/client';

import { mapSecondaryIdToDocumentId } from '@documenso/lib/utils/envelope';
import { prisma } from '@documenso/prisma';

import { getEnvelopeWhereInput } from './get-envelope-by-id';

export type GetEnvelopeQrCodeDataOptions = {
  envelopeId: string;
  userId: number;
  teamId: number;
};

/**
 * Returns QR share token and legacy document id for an envelope the user can access.
 */
export const getEnvelopeQrCodeData = async ({
  userId,
  teamId,
  envelopeId,
}: GetEnvelopeQrCodeDataOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: { type: 'envelopeId', id: envelopeId },
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const result = await prisma.envelope.findFirst({
    where: envelopeWhereInput,
    select: {
      qrToken: true,
      secondaryId: true,
      type: true,
    },
  });

  if (!result) {
    return null;
  }

  const documentId =
    result.type === EnvelopeType.DOCUMENT ? mapSecondaryIdToDocumentId(result.secondaryId) : null;

  return {
    qrToken: result.qrToken,
    documentId,
  };
};
