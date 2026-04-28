import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const SEND_SIGNING_REMINDERS_SWEEP_JOB_DEFINITION_ID = 'internal.send-signing-reminders-sweep';

const SEND_SIGNING_REMINDERS_SWEEP_JOB_DEFINITION_SCHEMA = z.object({});

export type TSendSigningRemindersSweepJobDefinition = z.infer<
  typeof SEND_SIGNING_REMINDERS_SWEEP_JOB_DEFINITION_SCHEMA
>;

export const SEND_SIGNING_REMINDERS_SWEEP_JOB_DEFINITION = {
  id: SEND_SIGNING_REMINDERS_SWEEP_JOB_DEFINITION_ID,
  name: 'Send Signing Reminders Sweep',
  version: '1.0.0',
  trigger: {
    name: SEND_SIGNING_REMINDERS_SWEEP_JOB_DEFINITION_ID,
    schema: SEND_SIGNING_REMINDERS_SWEEP_JOB_DEFINITION_SCHEMA,
    cron: '*/15 * * * *', // Every 15 minutes.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-signing-reminders-sweep.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_SIGNING_REMINDERS_SWEEP_JOB_DEFINITION_ID,
  TSendSigningRemindersSweepJobDefinition
>;
