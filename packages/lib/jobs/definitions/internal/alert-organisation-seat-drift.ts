import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const ALERT_ORGANISATION_SEAT_DRIFT_JOB_DEFINITION_ID = 'internal.alert-organisation-seat-drift';

const ALERT_ORGANISATION_SEAT_DRIFT_JOB_DEFINITION_SCHEMA = z.object({});

export type TAlertOrganisationSeatDriftJobDefinition = z.infer<
  typeof ALERT_ORGANISATION_SEAT_DRIFT_JOB_DEFINITION_SCHEMA
>;

export const ALERT_ORGANISATION_SEAT_DRIFT_JOB_DEFINITION = {
  id: ALERT_ORGANISATION_SEAT_DRIFT_JOB_DEFINITION_ID,
  name: 'Alert Organisation Seat Drift',
  version: '1.0.0',
  trigger: {
    name: ALERT_ORGANISATION_SEAT_DRIFT_JOB_DEFINITION_ID,
    schema: ALERT_ORGANISATION_SEAT_DRIFT_JOB_DEFINITION_SCHEMA,
    cron: '0 0 * * *', // Once a day at midnight.
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./alert-organisation-seat-drift.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof ALERT_ORGANISATION_SEAT_DRIFT_JOB_DEFINITION_ID,
  TAlertOrganisationSeatDriftJobDefinition
>;
