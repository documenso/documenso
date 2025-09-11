import { DocumentStatus, EnvelopeType } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { mapSecondaryIdToDocumentId } from '../../utils/envelope';

export type GetDocumentByAccessTokenOptions = {
  token: string;
};

export const getDocumentByAccessToken = async ({ token }: GetDocumentByAccessTokenOptions) => {
  if (!token) {
    throw new Error('Missing token');
  }

  const result = await prisma.envelope.findFirstOrThrow({
    where: {
      type: EnvelopeType.DOCUMENT,
      status: DocumentStatus.COMPLETED,
      qrToken: token,
    },
    // Do not provide extra information that is not needed.
    select: {
      id: true,
      secondaryId: true,
      title: true,
      completedAt: true,
      team: {
        select: {
          url: true,
        },
      },
      envelopeItems: {
        select: {
          documentData: {
            select: {
              id: true,
              type: true,
              data: true,
              initialData: true,
            },
          },
        },
      },
      _count: {
        select: {
          recipients: true,
        },
      },
    },
  });

  // Todo: Envelopes
  if (!result.envelopeItems[0].documentData) {
    throw new Error('Missing document data');
  }

  return {
    id: mapSecondaryIdToDocumentId(result.secondaryId),
    title: result.title,
    completedAt: result.completedAt,
    documentData: result.envelopeItems[0].documentData,
    recipientCount: result._count.recipients,
    documentTeamUrl: result.team.url,
  };
};
