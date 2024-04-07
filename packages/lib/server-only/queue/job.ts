import type { WorkHandler } from 'pg-boss';

import type { MailOptions } from '@documenso/email/mailer';
import { mailer } from '@documenso/email/mailer';
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
  'send-mail': MailOptions;
  'send-completed-email': SendCompletedDocumentOptions;
  'send-pending-email': SendPendingEmailOptions;
  'create-document-audit-log': CreateDocumentAuditLogDataOptions;
};

export const jobHandlers: {
  [K in keyof JobOptions]: WorkHandler<JobOptions[K]>;
} = {
  'send-completed-email': async ({ id, name, data: { documentId, requestMetadata } }) => {
    console.log('Running Queue: ', name, ' ', id);

    await sendCompletedEmail({
      documentId,
      requestMetadata,
    });
  },
  'send-pending-email': async ({ id, name, data: { documentId, recipientId } }) => {
    console.log('Running Queue: ', name, ' ', id);

    await sendPendingEmail({
      documentId,
      recipientId,
    });
  },
  'send-mail': async ({ id, name, data: { attachments, to, from, subject, html, text } }) => {
    console.log('Running Queue: ', name, ' ', id);

    await mailer.sendMail({
      to,
      from,
      subject,
      html,
      text,
      attachments,
    });
  },

  // Audit Logs Queue
  'create-document-audit-log': async ({
    name,
    data: { documentId, type, requestMetadata, user, data },
    id,
  }) => {
    console.log('Running Queue: ', name, ' ', id);

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
