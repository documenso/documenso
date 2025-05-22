import type { SubscriptionClaim } from '@prisma/client';
import { SubscriptionStatus } from '@prisma/client';
import { match } from 'ts-pattern';

import { createOrganisation } from '@documenso/lib/server-only/organisation/create-organisation';
import { type Stripe } from '@documenso/lib/server-only/stripe';
import type { StripeOrganisationCreateMetadata } from '@documenso/lib/types/subscription';
import { ZStripeOrganisationCreateMetadataSchema } from '@documenso/lib/types/subscription';
import { prisma } from '@documenso/prisma';

import { createOrganisationClaimUpsertData, extractStripeClaim } from './on-subscription-updated';

export type OnSubscriptionCreatedOptions = {
  subscription: Stripe.Subscription;
};

type StripeWebhookResponse = {
  success: boolean;
  message: string;
};

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

  const organisationId = await handleOrganisationCreateOrGet({
    subscription,
    customerId,
  });

  const subscriptionItem = subscription.items.data[0];
  const subscriptionClaim = await extractStripeClaim(subscriptionItem.price);

  // Todo: logging
  if (!subscriptionClaim) {
    console.error(`Subscription claim on ${subscriptionItem.price.id} not found`);

    throw Response.json(
      {
        success: false,
        message: `Subscription claim on ${subscriptionItem.price.id} not found`,
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }

  await handleSubscriptionCreate({
    subscription,
    organisationId,
    subscriptionClaim,
  });
};

type HandleSubscriptionCreateOptions = {
  subscription: Stripe.Subscription;
  organisationId: string;
  subscriptionClaim: SubscriptionClaim;
};

const handleSubscriptionCreate = async ({
  subscription,
  organisationId,
  subscriptionClaim,
}: HandleSubscriptionCreateOptions) => {
  const status = match(subscription.status)
    .with('active', () => SubscriptionStatus.ACTIVE)
    .with('past_due', () => SubscriptionStatus.PAST_DUE)
    .otherwise(() => SubscriptionStatus.INACTIVE);

  await prisma.$transaction(async (tx) => {
    await tx.subscription.create({
      data: {
        organisationId,
        status: status,
        planId: subscription.id,
        priceId: subscription.items.data[0].price.id,
        periodEnd: new Date(subscription.current_period_end * 1000),
        cancelAtPeriodEnd: subscription.cancel_at_period_end,
      },
    });

    await tx.organisationClaim.create({
      data: {
        organisation: {
          connect: {
            id: organisationId,
          },
        },
        originalSubscriptionClaimId: subscriptionClaim.id,
        ...createOrganisationClaimUpsertData(subscriptionClaim),
      },
    });
  });
};

type HandleOrganisationCreateOrGetOptions = {
  subscription: Stripe.Subscription;
  customerId: string;
};

const handleOrganisationCreateOrGet = async ({
  subscription,
  customerId,
}: HandleOrganisationCreateOrGetOptions) => {
  let organisationCreateFlowData: StripeOrganisationCreateMetadata | null = null;

  if (subscription.metadata?.organisationCreateData) {
    const parseResult = ZStripeOrganisationCreateMetadataSchema.safeParse(
      JSON.parse(subscription.metadata.organisationCreateData),
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
    });

    return createdOrganisation.id;
  }

  const organisation = await prisma.organisation.findFirst({
    where: {
      customerId,
    },
    include: {
      subscription: true,
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
  if (organisation.subscription) {
    console.error('Organisation already has a subscription');

    // This should never happen
    throw Response.json(
      {
        success: false,
        message: `Organisation already has a subscription`,
      } satisfies StripeWebhookResponse,
      { status: 500 },
    );
  }

  return organisation.id;
};
