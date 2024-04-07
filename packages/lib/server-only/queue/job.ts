import type { WorkHandler } from 'pg-boss';

import { initQueue } from '.';
import {
  type SendDocumentOptions as SendCompletedDocumentOptions,
  sendCompletedEmail,
} from '../document/send-completed-email';

type JobOptions = {
  'send-completed-email': SendCompletedDocumentOptions;
};

export const jobHandlers: {
  [K in keyof JobOptions]: WorkHandler<JobOptions[K]>;
} = {
  'send-completed-email': async ({ data }) => {
    await sendCompletedEmail({
      documentId: data.documentId,
      requestMetadata: data.requestMetadata,
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
