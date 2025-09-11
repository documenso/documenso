import { EnvelopeType } from '@prisma/client';

import { type EnvelopeIdOptions, mapSecondaryIdToDocumentId } from '../../utils/envelope';
import { getEnvelopeById } from '../envelope/get-envelope-by-id';

export type GetDocumentWithDetailsByIdOptions = {
  id: EnvelopeIdOptions;
  userId: number;
  teamId: number;
};

export const getDocumentWithDetailsById = async ({
  id,
  userId,
  teamId,
}: GetDocumentWithDetailsByIdOptions) => {
  const envelope = await getEnvelopeById({
    id,
    type: EnvelopeType.DOCUMENT,
    userId,
    teamId,
  });

  const legacyDocumentId = mapSecondaryIdToDocumentId(envelope.secondaryId);

  // Todo: Envelopes
  const firstDocumentData = envelope.envelopeItems[0].documentData;

  if (!firstDocumentData) {
    throw new Error('Document data not found');
  }

  return {
    ...envelope,
    documentData: firstDocumentData,
    id: legacyDocumentId,
    fields: envelope.fields.map((field) => ({
      ...field,
      documentId: legacyDocumentId,
    })),
    user: {
      id: envelope.userId,
      name: envelope.user.name,
      email: envelope.user.email,
    },
    team: {
      id: envelope.teamId,
      url: envelope.team.url,
    },
    recipients: envelope.recipients,
  };
};
