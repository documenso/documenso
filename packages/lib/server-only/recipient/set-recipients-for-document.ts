import { isUserEnterprise } from '@documenso/ee/server-only/util/is-document-enterprise';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import {
  type TRecipientActionAuthTypes,
  ZRecipientAuthOptionsSchema,
} from '@documenso/lib/types/document-auth';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { nanoid } from '@documenso/lib/universal/id';
import {
  createDocumentAuditLogData,
  diffRecipientChanges,
} from '@documenso/lib/utils/document-audit-logs';
import { createRecipientAuthOptions } from '@documenso/lib/utils/document-auth';
import { prisma } from '@documenso/prisma';
import type { Recipient } from '@documenso/prisma/client';
import { RecipientRole } from '@documenso/prisma/client';
import { SendStatus, SigningStatus } from '@documenso/prisma/client';

import { AppError, AppErrorCode } from '../../errors/app-error';

export interface SetRecipientsForDocumentOptions {
  userId: number;
  teamId?: number;
  documentId: number;
  recipients: {
    id?: number | null;
    email: string;
    name: string;
    role: RecipientRole;
    actionAuth?: TRecipientActionAuthTypes | null;
  }[];
  requestMetadata?: RequestMetadata;
}

export const setRecipientsForDocument = async ({
  userId,
  teamId,
  documentId,
  recipients,
  requestMetadata,
}: SetRecipientsForDocumentOptions): Promise<Recipient[]> => {
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

  const recipientsHaveActionAuth = recipients.some((recipient) => recipient.actionAuth);

  // Check if user has permission to set the global action auth.
  if (recipientsHaveActionAuth) {
    const isDocumentEnterprise = await isUserEnterprise({
      userId,
      teamId,
    });

    if (!isDocumentEnterprise) {
      throw new AppError(
        AppErrorCode.UNAUTHORIZED,
        'You do not have permission to set the action auth',
      );
    }
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
        let authOptions = ZRecipientAuthOptionsSchema.parse(recipient._persisted?.authOptions);

        if (recipient.actionAuth !== undefined) {
          authOptions = createRecipientAuthOptions({
            accessAuth: authOptions.accessAuth,
            actionAuth: recipient.actionAuth,
          });
        }

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
            authOptions,
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
            authOptions,
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
              data: {
                ...baseAuditLog,
                actionAuth: recipient.actionAuth || undefined,
              },
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

  // Filter out recipients that have been removed or have been updated.
  const filteredRecipients: Recipient[] = existingRecipients.filter((recipient) => {
    const isRemoved = removedRecipients.find(
      (removedRecipient) => removedRecipient.id === recipient.id,
    );
    const isUpdated = persistedRecipients.find(
      (persistedRecipient) => persistedRecipient.id === recipient.id,
    );

    return !isRemoved && !isUpdated;
  });

  return [...filteredRecipients, ...persistedRecipients];
};
