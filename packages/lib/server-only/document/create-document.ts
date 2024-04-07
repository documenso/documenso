'use server';

import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { DOCUMENT_AUDIT_LOG_TYPE } from '@documenso/lib/types/document-audit-logs';
import type { RequestMetadata } from '@documenso/lib/universal/extract-request-metadata';
import { prisma } from '@documenso/prisma';
import { WebhookTriggerEvents } from '@documenso/prisma/client';

import { queueJob } from '../queue/job';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';

export type CreateDocumentOptions = {
  title: string;
  userId: number;
  teamId?: number;
  documentDataId: string;
  requestMetadata?: RequestMetadata;
};

export const createDocument = async ({
  userId,
  title,
  documentDataId,
  teamId,
  requestMetadata,
}: CreateDocumentOptions) => {
  const user = await prisma.user.findFirstOrThrow({
    where: {
      id: userId,
    },
    include: {
      teamMembers: {
        select: {
          teamId: true,
        },
      },
    },
  });

  if (
    teamId !== undefined &&
    !user.teamMembers.some((teamMember) => teamMember.teamId === teamId)
  ) {
    throw new AppError(AppErrorCode.NOT_FOUND, 'Team not found');
  }

  const document = await prisma.document.create({
    data: {
      title,
      documentDataId,
      userId,
      teamId,
    },
  });

  await queueJob({
    job: 'create-document-audit-log',
    args: {
      type: DOCUMENT_AUDIT_LOG_TYPE.DOCUMENT_CREATED,
      documentId: document.id,
      user,
      requestMetadata,
      data: {
        title,
      },
    },
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_CREATED,
    data: document,
    userId,
    teamId,
  });

  return document;
};
