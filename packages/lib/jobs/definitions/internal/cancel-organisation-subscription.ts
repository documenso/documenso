import { z } from 'zod';

import type { JobDefinition } from '../../client/_internal/job';

const CANCEL_ORGANISATION_SUBSCRIPTION_JOB_DEFINITION_ID = 'internal.cancel-organisation-subscription';

const CANCEL_ORGANISATION_SUBSCRIPTION_JOB_DEFINITION_SCHEMA = z.object({
  /**
   * The Stripe subscription id (Subscription.planId in our schema).
   *
   * This must be captured before the local organisation row is deleted,
   * because the Subscription row cascades away when the organisation is
   * removed.
   */
  stripeSubscriptionId: z.string(),
  /**
   * The organisation id, for logging only. The organisation may no longer
   * exist by the time this job runs.
   */
  organisationId: z.string(),
});

export type TCancelOrganisationSubscriptionJobDefinition = z.infer<
  typeof CANCEL_ORGANISATION_SUBSCRIPTION_JOB_DEFINITION_SCHEMA
>;

export const CANCEL_ORGANISATION_SUBSCRIPTION_JOB_DEFINITION = {
  id: CANCEL_ORGANISATION_SUBSCRIPTION_JOB_DEFINITION_ID,
  name: 'Cancel Organisation Subscription',
  version: '1.0.0',
  trigger: {
    name: CANCEL_ORGANISATION_SUBSCRIPTION_JOB_DEFINITION_ID,
    schema: CANCEL_ORGANISATION_SUBSCRIPTION_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./cancel-organisation-subscription.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof CANCEL_ORGANISATION_SUBSCRIPTION_JOB_DEFINITION_ID,
  TCancelOrganisationSubscriptionJobDefinition
>;
