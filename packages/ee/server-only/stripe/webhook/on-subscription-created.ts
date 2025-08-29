import { OrganisationType, SubscriptionStatus } from '@prisma/client';
import { match } from 'ts-pattern';

import {
  createOrganisation,
  createOrganisationClaimUpsertData,
} from '@documenso/lib/server-only/organisation/create-organisation';
import { type Stripe } from '@documenso/lib/server-only/stripe';
import type {
  InternalClaim,
  StripeOrganisationCreateMetadata,
} from '@documenso/lib/types/subscription';
import {
  INTERNAL_CLAIM_ID,
  ZStripeOrganisationCreateMetadataSchema,
} from '@documenso/lib/types/subscription';
import { prisma } from '@documenso/prisma';

import { extractStripeClaim } from './on-subscription-updated';

export type OnSubscriptionCreatedOptions = {
  subscription: Stripe.Subscription;
};

type StripeWebhookResponse = {
  success: boolean;
  message: string;
};

/**
 * Todo: We might want to pull this into a job so we can do steps. Since if organisation creation passes but
 * fails after this would be automatically rerun by Stripe, which means duplicate organisations can be
 * potentially created.
 */
export const onSubscriptionCreated = async ({ subscription }: OnSubscriptionCreatedOptions) => {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  // Todo: logging
  if (subscription.items.data.length !== 1) {
    console.error('No support for multiple items');

    throw Response.json(
      {
        success: false,
        message: 'No support for multiple items',
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }

  const subscriptionItem = subscription.items.data[0];
  const claim = await extractStripeClaim(subscriptionItem.price);

  // Todo: logging
  if (!claim) {
    console.error(`Subscription claim on ${subscriptionItem.price.id} not found`);

    throw Response.json(
      {
        success: false,
        message: `Subscription claim on ${subscriptionItem.price.id} not found`,
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }

  const organisationCreateData = subscription.metadata?.organisationCreateData;

  // A new subscription can be for an existing organisation or a new one.
  const organisationId = organisationCreateData
    ? await handleOrganisationCreate({
        customerId,
        claim,
        unknownCreateData: organisationCreateData,
      })
    : await handleOrganisationUpdate({
        customerId,
        claim,
      });

  const status = match(subscription.status)
    .with('active', () => SubscriptionStatus.ACTIVE)
    .with('trialing', () => SubscriptionStatus.ACTIVE)
    .with('past_due', () => SubscriptionStatus.PAST_DUE)
    .otherwise(() => SubscriptionStatus.INACTIVE);

  const periodEnd =
    subscription.status === 'trialing' && subscription.trial_end
      ? new Date(subscription.trial_end * 1000)
      : new Date(subscription.current_period_end * 1000);

  await prisma.subscription.upsert({
    where: {
      organisationId,
    },
    create: {
      organisationId,
      status,
      customerId,
      planId: subscription.id,
      priceId: subscription.items.data[0].price.id,
      periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
    update: {
      status,
      customerId,
      planId: subscription.id,
      priceId: subscription.items.data[0].price.id,
      periodEnd,
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    },
  });
};

type HandleOrganisationCreateOptions = {
  customerId: string;
  claim: InternalClaim;
  unknownCreateData: string;
};

/**
 * Handles the creation of an organisation.
 */
const handleOrganisationCreate = async ({
  customerId,
  claim,
  unknownCreateData,
}: HandleOrganisationCreateOptions) => {
  let organisationCreateFlowData: StripeOrganisationCreateMetadata | null = null;

  const parseResult = ZStripeOrganisationCreateMetadataSchema.safeParse(
    JSON.parse(unknownCreateData),
  );

  if (!parseResult.success) {
    console.error('Invalid organisation create flow data');

    throw Response.json(
      {
        success: false,
        message: 'Invalid organisation create flow data',
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }

  organisationCreateFlowData = parseResult.data;

  const createdOrganisation = await createOrganisation({
    name: organisationCreateFlowData.organisationName,
    userId: organisationCreateFlowData.userId,
    type: OrganisationType.ORGANISATION,
    customerId,
    claim,
  });

  return createdOrganisation.id;
};

type HandleOrganisationUpdateOptions = {
  customerId: string;
  claim: InternalClaim;
};

/**
 * Handles the updating an exist organisation claims.
 */
const handleOrganisationUpdate = async ({ customerId, claim }: HandleOrganisationUpdateOptions) => {
  const organisation = await prisma.organisation.findFirst({
    where: {
      customerId,
    },
    include: {
      subscription: true,
      organisationClaim: true,
    },
  });

  if (!organisation) {
    throw Response.json(
      {
        success: false,
        message: `Organisation not found`,
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }

  // Todo: logging
  if (
    organisation.subscription &&
    organisation.subscription.status !== SubscriptionStatus.INACTIVE
  ) {
    console.error('Organisation already has an active subscription');

    // This should never happen
    throw Response.json(
      {
        success: false,
        message: `Organisation already has an active subscription`,
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }

  let newOrganisationType: OrganisationType = OrganisationType.ORGANISATION;

  // Keep the organisation as personal if the claim is for an individual.
  if (
    organisation.type === OrganisationType.PERSONAL &&
    claim.id === INTERNAL_CLAIM_ID.INDIVIDUAL
  ) {
    newOrganisationType = OrganisationType.PERSONAL;
  }

  await prisma.organisation.update({
    where: {
      id: organisation.id,
    },
    data: {
      type: newOrganisationType,
      organisationClaim: {
        update: {
          originalSubscriptionClaimId: claim.id,
          ...createOrganisationClaimUpsertData(claim),
        },
      },
    },
  });

  return organisation.id;
};
