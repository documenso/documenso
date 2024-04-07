import type { WorkHandler } from 'pg-boss';

import { initQueue } from '.';
import {
  type SendDocumentOptions as SendCompletedDocumentOptions,
  sendCompletedEmail,
} from '../document/send-completed-email';
import { type SendPendingEmailOptions, sendPendingEmail } from '../document/send-pending-email';

type JobOptions = {
  'send-completed-email': SendCompletedDocumentOptions;
  'send-pending-email': SendPendingEmailOptions;
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
