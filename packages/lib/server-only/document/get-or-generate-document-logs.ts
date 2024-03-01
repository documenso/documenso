import { prisma } from '@documenso/prisma';
import { AdditionalDataType, DocumentStatus } from '@documenso/prisma/client';

import { buildDocumentLogs } from '../pdf/build-document-logs';
import { getRecipientsForDocument } from '../recipient/get-recipients-for-document';
import { findDocumentAuditLogs } from './find-document-audit-logs';
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

  if (document.status !== DocumentStatus.COMPLETED) {
    throw new Error(`Document ${documentId} has not been completed`);
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

  const [recipients, { data: auditLogs }] = await Promise.all([
    getRecipientsForDocument({
      documentId,
      userId,
      teamId,
    }),
    findDocumentAuditLogs({
      documentId,
      userId,
      perPage: Number.MAX_SAFE_INTEGER,
    }),
  ]);

  const recipientsList: string[] = recipients.map((recipient) => {
    const text = recipient.name ? `${recipient.name} (${recipient.email})` : recipient.email;
    return `${text} - ${recipient.role}`;
  });

  // Generate PDF and save it as DocumentData
  const { type, data } = await buildDocumentLogs({
    document,
    recipientsList,
    auditLogs,
  });
  // Assigng the DocumentData to the document as auditLogsDataId
  return prisma.documentAdditionalData.upsert({
    where: additionalDataWhereInput,
    create: { type, data, documentId, contentType: AdditionalDataType.LOGS },
    update: { type, data },
  });
};
