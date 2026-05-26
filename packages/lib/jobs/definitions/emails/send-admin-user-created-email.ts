import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SEND_ADMIN_USER_CREATED_EMAIL_JOB_DEFINITION_ID = 'send.admin.user.created.email';

const SEND_ADMIN_USER_CREATED_EMAIL_JOB_DEFINITION_SCHEMA = z.object({
  userId: z.number(),
});

export type TSendAdminUserCreatedEmailJobDefinition = z.infer<
  typeof SEND_ADMIN_USER_CREATED_EMAIL_JOB_DEFINITION_SCHEMA
>;

export const SEND_ADMIN_USER_CREATED_EMAIL_JOB_DEFINITION = {
  id: SEND_ADMIN_USER_CREATED_EMAIL_JOB_DEFINITION_ID,
  name: 'Send Admin User Created Email',
  version: '1.0.0',
  trigger: {
    name: SEND_ADMIN_USER_CREATED_EMAIL_JOB_DEFINITION_ID,
    schema: SEND_ADMIN_USER_CREATED_EMAIL_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./send-admin-user-created-email.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SEND_ADMIN_USER_CREATED_EMAIL_JOB_DEFINITION_ID,
  TSendAdminUserCreatedEmailJobDefinition
>;
