import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const PROCESS_SIGNING_REMINDER_JOB_DEFINITION_ID = 'internal.process-signing-reminder';

const PROCESS_SIGNING_REMINDER_JOB_DEFINITION_SCHEMA = z.object({
  recipientId: z.number(),
});

export type TProcessSigningReminderJobDefinition = z.infer<
  typeof PROCESS_SIGNING_REMINDER_JOB_DEFINITION_SCHEMA
>;

export const PROCESS_SIGNING_REMINDER_JOB_DEFINITION = {
  id: PROCESS_SIGNING_REMINDER_JOB_DEFINITION_ID,
  name: 'Process Signing Reminder',
  version: '1.0.0',
  trigger: {
    name: PROCESS_SIGNING_REMINDER_JOB_DEFINITION_ID,
    schema: PROCESS_SIGNING_REMINDER_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./process-signing-reminder.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof PROCESS_SIGNING_REMINDER_JOB_DEFINITION_ID,
  TProcessSigningReminderJobDefinition
>;
