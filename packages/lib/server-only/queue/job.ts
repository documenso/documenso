import type { WorkHandler } from 'pg-boss';

import { prisma } from '@documenso/prisma';

import { initQueue } from '.';
import type { CreateDocumentAuditLogDataOptions } from '../../utils/document-audit-logs';
import { createDocumentAuditLogData } from '../../utils/document-audit-logs';
import {
  type SendDocumentOptions as SendCompletedDocumentOptions,
  sendCompletedEmail,
} from '../document/send-completed-email';
import { type SendPendingEmailOptions, sendPendingEmail } from '../document/send-pending-email';

type JobOptions = {
  'send-completed-email': SendCompletedDocumentOptions;
  'send-pending-email': SendPendingEmailOptions;
  'create-document-audit-log': CreateDocumentAuditLogDataOptions;
};

export const jobHandlers: {
  [K in keyof JobOptions]: WorkHandler<JobOptions[K]>;
} = {
  'send-completed-email': async ({ data: { documentId, requestMetadata } }) => {
    await sendCompletedEmail({
      documentId,
      requestMetadata,
    });
  },
  'send-pending-email': async ({ data: { documentId, recipientId } }) => {
    await sendPendingEmail({
      documentId,
      recipientId,
    });
  },

  // Audit Logs Queue
  'create-document-audit-log': async ({
    data: { documentId, type, requestMetadata, user, data },
    id,
  }) => {
    console.log('Running Queue ID', id);

    await prisma.documentAuditLog.create({
      data: createDocumentAuditLogData({
        type,
        documentId,
        requestMetadata,
        user,
        data,
      }),
    });
  },
};

export const queueJob = async ({
  job,
  args,
}: {
  job: keyof JobOptions;
  args?: JobOptions[keyof JobOptions];
}) => {
  const queue = await initQueue();

  await queue.send(job, args ?? {});
};
