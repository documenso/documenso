import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { parseDocumentIdToEnvelopeSecondaryId } from '../../utils/envelope';

export type GetEntireDocumentOptions = {
  id: number;
};

export const getEntireDocument = async ({ id }: GetEntireDocumentOptions) => {
  const envelope = await prisma.envelope.findFirstOrThrow({
    where: {
      type: EnvelopeType.DOCUMENT,
      secondaryId: parseDocumentIdToEnvelopeSecondaryId(id),
    },
    include: {
      documentMeta: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      recipients: {
        include: {
          fields: {
            include: {
              signature: true,
            },
          },
        },
      },
    },
  });

  return envelope;
};
