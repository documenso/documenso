import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const ADMIN_DELETE_ORGANISATION_JOB_DEFINITION_ID = 'internal.admin-delete-organisation';

const ADMIN_DELETE_ORGANISATION_JOB_DEFINITION_SCHEMA = z.object({
  organisationId: z.string(),
  /**
   * Whether to email the organisation owner notifying them of the deletion.
   */
  sendEmailToOwner: z.boolean(),
  /**
   * The id of the admin user who requested the deletion (for audit/logging).
   */
  requestedByUserId: z.number(),
});

export type TAdminDeleteOrganisationJobDefinition = z.infer<typeof ADMIN_DELETE_ORGANISATION_JOB_DEFINITION_SCHEMA>;

export const ADMIN_DELETE_ORGANISATION_JOB_DEFINITION = {
  id: ADMIN_DELETE_ORGANISATION_JOB_DEFINITION_ID,
  name: 'Admin Delete Organisation',
  version: '1.0.0',
  trigger: {
    name: ADMIN_DELETE_ORGANISATION_JOB_DEFINITION_ID,
    schema: ADMIN_DELETE_ORGANISATION_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./admin-delete-organisation.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof ADMIN_DELETE_ORGANISATION_JOB_DEFINITION_ID,
  TAdminDeleteOrganisationJobDefinition
>;
