import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_ORGANISATION_MEMBER_JOINED_EMAIL_JOB_DEFINITION_ID =
  'send.organisation-member-joined.email';

const SEND_ORGANISATION_MEMBER_JOINED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  organisationId: z.string(),
  memberUserId: z.number(),
});

export type TSendOrganisationMemberJoinedEmailJobDefinition = z.infer<
  typeof SEND_ORGANISATION_MEMBER_JOINED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_ORGANISATION_MEMBER_JOINED_EMAIL_JOB_DEFINITION = {
  id: SEND_ORGANISATION_MEMBER_JOINED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Organisation Member Joined Email',
  version: '1.0.0',
  trigger: {
    name: SEND_ORGANISATION_MEMBER_JOINED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_ORGANISATION_MEMBER_JOINED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-organisation-member-joined-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_ORGANISATION_MEMBER_JOINED_EMAIL_JOB_DEFINITION_ID,
  TSendOrganisationMemberJoinedEmailJobDefinition
>;
