import { WebhookTriggerEvents } from '@prisma/client';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { triggerWebhook } from '@documenso/lib/server-only/webhooks/trigger/trigger-webhook';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '@documenso/lib/types/webhook-payload';
import type { ApiRequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { createDocumentAuditLogData } from '@documenso/lib/utils/document-audit-logs';
import { prisma } from '@documenso/prisma';

export type RestoreDocumentOptions = {
  id: number;
  userId: number;
  teamId?: number;
  requestMetadata: ApiRequestMetadata;
};

export const restoreDocument = async ({
  id,
  userId,
  teamId,
  requestMetadata,
}: RestoreDocumentOptions) => {
  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User not found',
    });
  }

  const document = await prisma.document.findUnique({
    where: {
      id,
    },
    include: {
      recipients: true,
      documentMeta: true,
      team: {
        include: {
          members: true,
        },
      },
    },
  });

  if (!document || (teamId !== undefined && teamId !== document.teamId)) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const isUserOwner = document.userId === userId;
  const isUserTeamMember = document.team?.members.some((member) => member.userId === userId);

  if (!isUserOwner && !isUserTeamMember) {
    throw new AppError(AppErrorCode.UNAUTHORIZED, {
      message: 'Not allowed to restore this document',
    });
  }

  const restoredDocument = await prisma.$transaction(async (tx) => {
    await tx.documentAuditLog.create({
      data: createDocumentAuditLogData({
        documentId: document.id,
        type: 'DOCUMENT_RESTORED',
        metadata: requestMetadata,
        data: {},
      }),
    });

    return await tx.document.update({
      where: {
        id: document.id,
      },
      data: {
        deletedAt: null,
      },
    });
  });

  await prisma.recipient.updateMany({
    where: {
      documentId: document.id,
      documentDeletedAt: {
        not: null,
      },
    },
    data: {
      documentDeletedAt: null,
    },
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_RESTORED,
    data: ZWebhookDocumentSchema.parse(mapDocumentToWebhookDocumentPayload(document)),
    userId,
    teamId,
  });

  return restoredDocument;
};
