import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const SYNC_ORGANISATION_SEATS_JOB_DEFINITION_ID = 'internal.sync-organisation-seats';

const SYNC_ORGANISATION_SEATS_JOB_DEFINITION_SCHEMA = z.object({
  organisationId: z.string(),
});

export type TSyncOrganisationSeatsJobDefinition = z.infer<typeof SYNC_ORGANISATION_SEATS_JOB_DEFINITION_SCHEMA>;

export const SYNC_ORGANISATION_SEATS_JOB_DEFINITION = {
  id: SYNC_ORGANISATION_SEATS_JOB_DEFINITION_ID,
  name: 'Sync Organisation Seats',
  version: '1.0.0',
  trigger: {
    name: SYNC_ORGANISATION_SEATS_JOB_DEFINITION_ID,
    schema: SYNC_ORGANISATION_SEATS_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./sync-organisation-seats.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof SYNC_ORGANISATION_SEATS_JOB_DEFINITION_ID,
  TSyncOrganisationSeatsJobDefinition
>;
