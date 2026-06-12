import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_ORGANISATION_MEMBER_INVITE_DECLINED_EMAIL_JOB_DEFINITION_ID =
  'send.organisation-member-invite-declined.email';

const SEND_ORGANISATION_MEMBER_INVITE_DECLINED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  organisationId: z.string(),
  inviteId: z.string(),
  inviteeEmail: z.string(),
});

export type TSendOrganisationMemberInviteDeclinedEmailJobDefinition = z.infer<
  typeof SEND_ORGANISATION_MEMBER_INVITE_DECLINED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_ORGANISATION_MEMBER_INVITE_DECLINED_EMAIL_JOB_DEFINITION = {
  id: SEND_ORGANISATION_MEMBER_INVITE_DECLINED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Organisation Member Invite Declined Email',
  version: '1.0.0',
  trigger: {
    name: SEND_ORGANISATION_MEMBER_INVITE_DECLINED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_ORGANISATION_MEMBER_INVITE_DECLINED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-organisation-member-invite-declined-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_ORGANISATION_MEMBER_INVITE_DECLINED_EMAIL_JOB_DEFINITION_ID,
  TSendOrganisationMemberInviteDeclinedEmailJobDefinition
>;
