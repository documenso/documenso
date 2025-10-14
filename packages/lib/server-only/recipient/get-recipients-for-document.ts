import { EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { getEnvelopeWhereInput } from '../envelope/get-envelope-by-id';

export interface GetRecipientsForDocumentOptions {
  documentId: number;
  userId: number;
  teamId: number;
}

export const getRecipientsForDocument = async ({
  documentId,
  userId,
  teamId,
}: GetRecipientsForDocumentOptions) => {
  const { envelopeWhereInput } = await getEnvelopeWhereInput({
    id: {
      type: 'documentId',
      id: documentId,
    },
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const recipients = await prisma.recipient.findMany({
    where: {
      envelope: envelopeWhereInput,
    },
    orderBy: {
      id: 'asc',
    },
  });

  return recipients;
};
