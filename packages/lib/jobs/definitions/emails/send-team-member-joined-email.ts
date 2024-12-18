import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_ID = 'send.team-member-joined.email';

const SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  teamId: z.number(),
  memberId: z.number(),
});

export type TSendTeamMemberJoinedEmailJobDefinition = z.infer<
  typeof SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION = {
  id: SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Team Member Joined Email',
  version: '1.0.0',
  trigger: {
    name: SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-team-member-joined-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_TEAM_MEMBER_JOINED_EMAIL_JOB_DEFINITION_ID,
  TSendTeamMemberJoinedEmailJobDefinition
>;
