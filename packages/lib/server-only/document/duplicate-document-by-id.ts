import { DocumentSource, type Prisma, WebhookTriggerEvents } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import {
  ZWebhookDocumentSchema,
  mapDocumentToWebhookDocumentPayload,
} from '../../types/webhook-payload';
import { prefixedId } from '../../universal/id';
import { triggerWebhook } from '../webhooks/trigger/trigger-webhook';
import { getDocumentWhereInput } from './get-document-by-id';

export interface DuplicateDocumentOptions {
  documentId: number;
  userId: number;
  teamId?: number;
}

export const duplicateDocument = async ({
  documentId,
  userId,
  teamId,
}: DuplicateDocumentOptions) => {
  const documentWhereInput = await getDocumentWhereInput({
    documentId,
    userId,
    teamId,
  });

  const document = await prisma.document.findFirst({
    where: documentWhereInput,
    select: {
      title: true,
      userId: true,
      documentData: {
        select: {
          data: true,
          initialData: true,
          type: true,
        },
      },
      documentMeta: {
        select: {
          message: true,
          subject: true,
          dateFormat: true,
          password: true,
          timezone: true,
          redirectUrl: true,
        },
      },
    },
  });

  if (!document) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'Document not found',
    });
  }

  const createDocumentArguments: Prisma.DocumentCreateArgs = {
    data: {
      title: document.title,
      qrToken: prefixedId('qr'),
      user: {
        connect: {
          id: document.userId,
        },
      },
      documentData: {
        create: {
          ...document.documentData,
          data: document.documentData.initialData,
        },
      },
      documentMeta: {
        create: {
          ...document.documentMeta,
        },
      },
      source: DocumentSource.DOCUMENT,
    },
  };

  if (teamId !== undefined) {
    createDocumentArguments.data.team = {
      connect: {
        id: teamId,
      },
    };
  }

  const createdDocument = await prisma.document.create({
    ...createDocumentArguments,
    include: {
      recipients: true,
      documentMeta: true,
    },
  });

  await triggerWebhook({
    event: WebhookTriggerEvents.DOCUMENT_CREATED,
    data: ZWebhookDocumentSchema.parse({
      ...mapDocumentToWebhookDocumentPayload(createdDocument),
      recipients: createdDocument.recipients,
      documentMeta: createdDocument.documentMeta,
    }),
    userId: userId,
    teamId: teamId,
  });

  return {
    documentId: createdDocument.id,
  };
};
