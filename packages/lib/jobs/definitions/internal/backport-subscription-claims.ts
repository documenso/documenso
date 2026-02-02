import { z } from 'zod';

import { type JobDefinition } from '../../client/_internal/job';

const BACKPORT_SUBSCRIPTION_CLAIM_JOB_DEFINITION_ID = 'internal.backport-subscription-claims';

const BACKPORT_SUBSCRIPTION_CLAIM_JOB_DEFINITION_SCHEMA = z.object({
  subscriptionClaimId: z.string(),
  // I would prefer to fetch the subscription within the runner, but
  // it seems the local job runs it asynchronously, so we can't get
  // the updated values in the job.
  flags: z.object({
    unlimitedDocuments: z.literal(true).optional(),
    allowCustomBranding: z.literal(true).optional(),
    hidePoweredBy: z.literal(true).optional(),
    embedAuthoring: z.literal(true).optional(),
    embedAuthoringWhiteLabel: z.literal(true).optional(),
    embedSigning: z.literal(true).optional(),
    embedSigningWhiteLabel: z.literal(true).optional(),
    cfr21: z.literal(true).optional(),
    // Todo: Envelopes - Do we need to check?
    // authenticationPortal & emailDomains missing here.
  }),
});

export type TBackportSubscriptionClaimJobDefinition = z.infer<
  typeof BACKPORT_SUBSCRIPTION_CLAIM_JOB_DEFINITION_SCHEMA
>;

export const BACKPORT_SUBSCRIPTION_CLAIM_JOB_DEFINITION = {
  id: BACKPORT_SUBSCRIPTION_CLAIM_JOB_DEFINITION_ID,
  name: 'Backport Subscription Claims',
  version: '1.0.0',
  trigger: {
    name: BACKPORT_SUBSCRIPTION_CLAIM_JOB_DEFINITION_ID,
    schema: BACKPORT_SUBSCRIPTION_CLAIM_JOB_DEFINITION_SCHEMA,
  },
  handler: async ({ payload, io }) => {
    const handler = await import('./backport-subscription-claims.handler');

    await handler.run({ payload, io });
  },
} as const satisfies JobDefinition<
  typeof BACKPORT_SUBSCRIPTION_CLAIM_JOB_DEFINITION_ID,
  TBackportSubscriptionClaimJobDefinition
>;
