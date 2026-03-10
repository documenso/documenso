import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION_ID = 'internal.expire-recipients-sweep';

const EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION_SCHEMA = z.object({});

export type TExpireRecipientsSweepJobDefinition = z.infer<
  typeof EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION_SCHEMA
>;

export const EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION = {
  id: EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION_ID,
  name: 'Expire Recipients Sweep',
  version: '1.0.0',
  trigger: {
    name: EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION_ID,
    schema: EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION_SCHEMA,
    cron: '*/15 * * * *', // Every 15 minutes.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./expire-recipients-sweep.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof EXPIRE_RECIPIENTS_SWEEP_JOB_DEFINITION_ID,
  TExpireRecipientsSweepJobDefinition
>;
