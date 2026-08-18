import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

import { resolveSweepCron } from './sweep-crons';

const SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_ID = 'internal.seal-document-sweep';

const SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_SCHEMA = z.object({});

export type TSealDocumentSweepJobDefinition = z.infer<typeof SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_SCHEMA>;

export const SEAL_DOCUMENT_SWEEP_JOB_DEFINITION = {
  id: SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_ID,
  name: 'Seal Document Sweep',
  version: '1.0.0',
  trigger: {
    name: SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_ID,
    schema: SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_SCHEMA,
    cron: resolveSweepCron('NEXT_PRIVATE_JOBS_SEAL_DOCUMENT_SWEEP_CRON'), // Every 15 minutes by default; see #2811.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./seal-document-sweep.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<typeof SEAL_DOCUMENT_SWEEP_JOB_DEFINITION_ID, TSealDocumentSweepJobDefinition>;
