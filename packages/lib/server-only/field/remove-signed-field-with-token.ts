'use server';

<<<<<<< HEAD
=======
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
>>>>>>> main
import { prisma } from '@documenso/prisma';
import { DocumentStatus, SigningStatus } from '@documenso/prisma/client';

export type RemovedSignedFieldWithTokenOptions = {
  token: string;
  fieldId: number;
<<<<<<< HEAD
=======
  requestMetadata?: RequestMetadata;
>>>>>>> main
};

export const removeSignedFieldWithToken = async ({
  token,
  fieldId,
<<<<<<< HEAD
=======
  requestMetadata,
>>>>>>> main
}: RemovedSignedFieldWithTokenOptions) => {
  const field = await prisma.field.findFirstOrThrow({
    where: {
      id: fieldId,
      Recipient: {
        token,
      },
    },
    include: {
      Document: true,
      Recipient: true,
    },
  });

  const { Document: document, Recipient: recipient } = field;

<<<<<<< HEAD
=======
  if (!document) {
    throw new Error(`Document not found for field ${field.id}`);
  }

>>>>>>> main
  if (document.status === DocumentStatus.COMPLETED) {
    throw new Error(`Document ${document.id} has already been completed`);
  }

  if (recipient?.signingStatus === SigningStatus.SIGNED) {
    throw new Error(`Recipient ${recipient.id} has already signed`);
  }

  // Unreachable code based on the above query but we need to satisfy TypeScript
  if (field.recipientId === null) {
    throw new Error(`Field ${fieldId} has no recipientId`);
  }

<<<<<<< HEAD
  await Promise.all([
    prisma.field.update({
=======
  await prisma.$transaction(async (tx) => {
    await tx.field.update({
>>>>>>> main
      where: {
        id: field.id,
      },
      data: {
        customText: '',
        inserted: false,
      },
<<<<<<< HEAD
    }),
    prisma.signature.deleteMany({
      where: {
        fieldId: field.id,
      },
    }),
  ]);
=======
    });

    await tx.signature.deleteMany({
      where: {
        fieldId: field.id,
      },
    });

    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_FIELD_UNINSERTED,
        documentId: document.id,
        user: {
          name: recipient?.name,
          email: recipient?.email,
        },
        requestMetadata,
        data: {
          field: field.type,
          fieldId: field.secondaryId,
        },
      }),
    });
  });
>>>>>>> main
};
