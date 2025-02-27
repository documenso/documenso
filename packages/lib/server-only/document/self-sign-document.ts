import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { putPdfFile } from '@documenso/lib/universal/upload/put-file';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { DocumentStatus, RecipientRole, SendStatus, SigningStatus } from '@documenso/prisma/client';

import { jobs } from '../../jobs/client';
import { getFile } from '../../universal/upload/get-file';
import { insertFormValuesInPdf } from '../pdf/insert-form-values-in-pdf';

export type SelfSignDocumentOptions = {
  documentId: number;
  userId: number;
  teamId?: number;
  requestMetadata?: ApiRequestMetadata;
};

export const selfSignDocument = async ({
  documentId,
  userId,
  teamId,
  requestMetadata,
}: SelfSignDocumentOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  const document = await prisma.document.findUnique({
    where: {
      id: documentId,
      ...(teamId
        ? {
            team: {
              id: teamId,
              members: {
                some: {
                  userId,
                },
              },
            },
          }
        : {
            userId,
            teamId: null,
          }),
    },
    include: {
      recipients: {
        orderBy: [{ signingOrder: { sort: 'asc', nulls: 'last' } }, { id: 'asc' }],
      },
      documentMeta: true,
      documentData: true,
    },
  });

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.recipients.length === 0) {
    throw new Error('Document has no recipients');
  }

  if (document.recipients.length !== 1 || document.recipients[0].email !== user.email) {
    throw new Error('Invalid document for self-signing');
  }

  if (document.status === DocumentStatus.COMPLETED) {
    throw new Error('Can not sign completed document');
  }

  const { documentData } = document;

  if (!documentData || !documentData.data) {
    throw new Error('Document data not found');
  }

  if (document.formValues) {
    const file = await getFile(documentData);

    const prefilled = await insertFormValuesInPdf({
      pdf: Buffer.from(file),
      // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
      formValues: document.formValues as Record<string, string | number | boolean>,
    });

    const newDocumentData = await putPdfFile({
      name: document.title,
      type: 'application/pdf',
      arrayBuffer: async () => Promise.resolve(prefilled),
    });

    const result = await prisma.document.update({
      where: {
        id: document.id,
      },
      data: {
        documentDataId: newDocumentData.id,
      },
    });

    Object.assign(document, result);
  }

  const recipientHasNoActionToTake =
    document.recipients[0].role === RecipientRole.CC ||
    document.recipients[0].signingStatus === SigningStatus.SIGNED;

  if (recipientHasNoActionToTake) {
    await jobs.triggerJob({
      name: 'internal.seal-document',
      payload: {
        documentId,
        requestMetadata: requestMetadata?.requestMetadata,
      },
    });

    return await prisma.document.findFirstOrThrow({
      where: {
        id: documentId,
      },
      include: {
        recipients: true,
      },
    });
  }

  const updatedDocument = await prisma.$transaction(async (tx) => {
    if (document.status === DocumentStatus.DRAFT) {
      await tx.documentAuditLog.create({
        data: createDocumentAuditLogData({
          type: DOCUMENT_AUDIT_LOG_TYPE.SELF_SIGN,
          documentId: document.id,
          requestMetadata: requestMetadata?.requestMetadata,
          user,
          data: {
            recipientId: document.recipients[0].id,
            recipientEmail: document.recipients[0].email,
            recipientName: document.recipients[0].name,
            recipientRole: document.recipients[0].role,
          },
        }),
      });
    }

    await tx.recipient.update({
      where: {
        id: document.recipients[0].id,
      },
      data: {
        sendStatus: SendStatus.SENT,
      },
    });

    return await tx.document.update({
      where: {
        id: documentId,
      },
      data: {
        status: DocumentStatus.PENDING,
      },
      include: {
        recipients: true,
      },
    });
  });

  return updatedDocument;
};
