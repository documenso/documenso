import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { nanoid } from '@documenso/lib/universal/id';
import {
  createDocumentAuditLogData,
  diffRecipientChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';
import { RecipientRole } from '@documenso/prisma/client';
import { SendStatus, SigningStatus } from '@documenso/prisma/client';

export interface SetRecipientsForDocumentOptions {
  userId: number;
  teamId?: number;
  documentId: number;
  recipients: {
    id?: number | null;
    email: string;
    name: string;
    role: RecipientRole;
  }[];
  requestMetadata?: RequestMetadata;
}

export const setRecipientsForDocument = async ({
  userId,
  teamId,
  documentId,
  recipients,
  requestMetadata,
}: SetRecipientsForDocumentOptions) => {
  const document = await prisma.document.findFirst({
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
  });

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

  if (!document) {
    throw new Error('Document not found');
  }

  if (document.completedAt) {
    throw new Error('Document already complete');
  }

  const normalizedRecipients = recipients.map((recipient) => ({
    ...recipient,
    email: recipient.email.toLowerCase(),
  }));

  const existingRecipients = await prisma.recipient.findMany({
    where: {
      documentId,
    },
  });

  const removedRecipients = existingRecipients.filter(
    (existingRecipient) =>
      !normalizedRecipients.find(
        (recipient) =>
          recipient.id === existingRecipient.id || recipient.email === existingRecipient.email,
      ),
  );

  const linkedRecipients = normalizedRecipients
    .map((recipient) => {
      const existing = existingRecipients.find(
        (existingRecipient) =>
          existingRecipient.id === recipient.id || existingRecipient.email === recipient.email,
      );

      return {
        ...recipient,
        _persisted: existing,
      };
    })
    .filter((recipient) => {
      return (
        recipient._persisted?.role === RecipientRole.CC ||
        (recipient._persisted?.sendStatus !== SendStatus.SENT &&
          recipient._persisted?.signingStatus !== SigningStatus.SIGNED)
      );
    });

  const persistedRecipients = await prisma.$transaction(async (tx) => {
    return await Promise.all(
      linkedRecipients.map(async (recipient) => {
        const upsertedRecipient = await tx.recipient.upsert({
          where: {
            id: recipient._persisted?.id ?? -1,
            documentId,
          },
          update: {
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            documentId,
            sendStatus: recipient.role === RecipientRole.CC ? SendStatus.SENT : SendStatus.NOT_SENT,
            signingStatus:
              recipient.role === RecipientRole.CC ? SigningStatus.SIGNED : SigningStatus.NOT_SIGNED,
          },
          create: {
            name: recipient.name,
            email: recipient.email,
            role: recipient.role,
            token: nanoid(),
            documentId,
            sendStatus: recipient.role === RecipientRole.CC ? SendStatus.SENT : SendStatus.NOT_SENT,
            signingStatus:
              recipient.role === RecipientRole.CC ? SigningStatus.SIGNED : SigningStatus.NOT_SIGNED,
          },
        });

        const recipientId = upsertedRecipient.id;

        // Clear all fields if the recipient role is changed to a type that cannot have fields.
        if (
          recipient._persisted &&
          recipient._persisted.role !== recipient.role &&
          (recipient.role === RecipientRole.CC || recipient.role === RecipientRole.VIEWER)
        ) {
          await tx.field.deleteMany({
            where: {
              recipientId,
            },
          });
        }

        const baseAuditLog = {
          recipientEmail: upsertedRecipient.email,
          recipientName: upsertedRecipient.name,
          recipientId,
          recipientRole: upsertedRecipient.role,
        };

        const changes = recipient._persisted
          ? diffRecipientChanges(recipient._persisted, upsertedRecipient)
          : [];

        // Handle recipient updated audit log.
        if (recipient._persisted && changes.length > 0) {
          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_UPDATED,
              documentId: documentId,
              user,
              requestMetadata,
              data: {
                changes,
                ...baseAuditLog,
              },
            }),
          });
        }

        // Handle recipient created audit log.
        if (!recipient._persisted) {
          await tx.documentAuditLog.create({
            data: createDocumentAuditLogData({
              type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_CREATED,
              documentId: documentId,
              user,
              requestMetadata,
              data: baseAuditLog,
            }),
          });
        }

        return upsertedRecipient;
      }),
    );
  });

  if (removedRecipients.length > 0) {
    await prisma.$transaction(async (tx) => {
      await tx.recipient.deleteMany({
        where: {
          id: {
            in: removedRecipients.map((recipient) => recipient.id),
          },
        },
      });

      await tx.documentAuditLog.createMany({
        data: removedRecipients.map((recipient) =>
          createDocumentAuditLogData({
            type: DOCUMENT_AUDIT_LOG_TYPE.RECIPIENT_DELETED,
            documentId: documentId,
            user,
            requestMetadata,
            data: {
              recipientEmail: recipient.email,
              recipientName: recipient.name,
              recipientId: recipient.id,
              recipientRole: recipient.role,
            },
          }),
        ),
      });
    });
  }

  return persistedRecipients;
};
