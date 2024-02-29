import { prisma } from '@documenso/prisma';
import { AdditionalDataType, DocumentDataType, DocumentStatus } from '@documenso/prisma/client';

import { getDocumentById } from './get-document-by-id';

export type GetOrGenerateDocumentOptions = {
  documentId: number;
  userId: number;
  teamId?: number;
  overwrite?: boolean;
};

export const getOrGenerateDocumentLogs = async ({
  documentId,
  userId,
  teamId,
  overwrite,
}: GetOrGenerateDocumentOptions) => {
  const document = await getDocumentById({ id: documentId, userId, teamId });

  if (document.status === DocumentStatus.COMPLETED) {
    throw new Error('Document has not been completed yet');
  }

  const additionalDataWhereInput = {
    documentId_contentType: { documentId, contentType: AdditionalDataType.LOGS },
  };

  const documentLogsData = await prisma.documentAdditionalData.findUnique({
    where: additionalDataWhereInput,
  });

  if (documentLogsData && !overwrite) {
    return documentLogsData;
  }

  // Generate PDF and save it as DocumentData
  const { type, data } = { type: DocumentDataType.BYTES_64, data: '' };
  // Assigng the DocumentData to the document as auditLogsDataId
  return prisma.documentAdditionalData.upsert({
    where: additionalDataWhereInput,
    create: { type, data, documentId, contentType: AdditionalDataType.LOGS },
    update: { type, data },
  });
};
