import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_ID = 'send.team-deleted.email';

const SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  organisationId: z.string(),
  team: z.object({
    name: z.string(),
    url: z.string(),
  }),
  members: z.array(
    z.object({
      id: z.number(),
      name: z.string(),
      email: z.string(),
    }),
  ),
});

export type TSendTeamDeletedEmailJobDefinition = z.infer<
  typeof SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION = {
  id: SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Team Deleted Email',
  version: '1.0.0',
  trigger: {
    name: SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-team-deleted-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_TEAM_DELETED_EMAIL_JOB_DEFINITION_ID,
  TSendTeamDeletedEmailJobDefinition
>;
