import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_ID = 'internal.seal-document-sweep';

const SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_SCHEMA = z.object({});

export type TSealDocumentSweepJobDefinition = z.infer<
  typeof SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_SCHEMA
>;

export const SEAL_DOCUMENT_SWEEP_JOB_DEFINITION = {
  id: SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_ID,
  name: 'Seal Document Sweep',
  version: '1.0.0',
  trigger: {
    name: SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_ID,
    schema: SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_SCHEMA,
    cron: '*/15 * * * *', // Every 15 minutes.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./seal-document-sweep.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_ID,
  TSealDocumentSweepJobDefinition
>;
