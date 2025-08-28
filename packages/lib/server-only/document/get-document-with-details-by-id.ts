import { mapEnvelopeToLegacyDocument } from '../../utils/document';
import { getEnvelopeById } from '../envelope/get-envelope-by-id';

export type GetDocumentWithDetailsByIdOptions = {
  documentId: number;
  userId: number;
  teamId: number;
};

export const getDocumentWithDetailsById = async ({
  documentId,
  userId,
  teamId,
}: GetDocumentWithDetailsByIdOptions) => {
  const envelope = await getEnvelopeById({
    id: {
      type: 'documentId',
      id: documentId,
    },
    userId,
    teamId,
  });

  // Todo: Standardise mapping logic this.
  return mapEnvelopeToLegacyDocument(envelope);
};
