import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SCHEDULED_SEND_SWEEP_JOB_DEFINITION_ID = 'internal.scheduled-send-sweep';

const SCHEDULED_SEND_SWEEP_JOB_DEFINITION_SCHEMA = z.object({});

export type TScheduledSendSweepJobDefinition = z.infer<
  typeof SCHEDULED_SEND_SWEEP_JOB_DEFINITION_SCHEMA
>;

export const SCHEDULED_SEND_SWEEP_JOB_DEFINITION = {
  id: SCHEDULED_SEND_SWEEP_JOB_DEFINITION_ID,
  name: 'Scheduled Send Sweep',
  version: '1.0.0',
  trigger: {
    name: SCHEDULED_SEND_SWEEP_JOB_DEFINITION_ID,
    schema: SCHEDULED_SEND_SWEEP_JOB_DEFINITION_SCHEMA,
    cron: '* * * * *', // Every minute.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./scheduled-send-sweep.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SCHEDULED_SEND_SWEEP_JOB_DEFINITION_ID,
  TScheduledSendSweepJobDefinition
>;
