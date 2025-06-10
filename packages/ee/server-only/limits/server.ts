import { DocumentSource, SubscriptionStatus } from '@prisma/client';
import { DateTime } from 'luxon';

import { IS_BILLING_ENABLED } from '@documenso/lib/constants/app';
import { INTERNAL_CLAIM_ID } from '@documenso/lib/types/subscription';
import { prisma } from '@documenso/prisma';

import {
  FREE_PLAN_LIMITS,
  INACTIVE_PLAN_LIMITS,
  PAID_PLAN_LIMITS,
  SELFHOSTED_PLAN_LIMITS,
} from './constants';
import { ERROR_CODES } from './errors';
import type { TLimitsResponseSchema } from './schema';

export type GetServerLimitsOptions = {
  userId: number;
  teamId: number;
};

export const getServerLimits = async ({
  userId,
  teamId,
}: GetServerLimitsOptions): Promise<TLimitsResponseSchema> => {
  if (!IS_BILLING_ENABLED()) {
    return {
      quota: SELFHOSTED_PLAN_LIMITS,
      remaining: SELFHOSTED_PLAN_LIMITS,
    };
  }

  const organisation = await prisma.organisation.findFirst({
    where: {
      teams: {
        some: {
          id: teamId,
        },
      },
      members: {
        some: {
          userId,
        },
      },
    },
    include: {
      subscription: true,
      organisationClaim: true,
    },
  });

  if (!organisation) {
    throw new Error(ERROR_CODES.USER_FETCH_FAILED);
  }

  const quota = structuredClone(FREE_PLAN_LIMITS);
  const remaining = structuredClone(FREE_PLAN_LIMITS);

  const subscription = organisation.subscription;

  // Bypass all limits even if plan expired for ENTERPRISE.
  if (organisation.organisationClaimId === INTERNAL_CLAIM_ID.ENTERPRISE) {
    return {
      quota: PAID_PLAN_LIMITS,
      remaining: PAID_PLAN_LIMITS,
    };
  }

  // If plan expired.
  if (subscription && subscription.status !== SubscriptionStatus.ACTIVE) {
    return {
      quota: INACTIVE_PLAN_LIMITS,
      remaining: INACTIVE_PLAN_LIMITS,
    };
  }

  if (subscription && organisation.organisationClaim.flags.unlimitedDocuments) {
    return {
      quota: PAID_PLAN_LIMITS,
      remaining: PAID_PLAN_LIMITS,
    };
  }

  // If free tier or plan does not have unlimited documents.
  if (!subscription || !organisation.organisationClaim.flags.unlimitedDocuments) {
    const [documents, directTemplates] = await Promise.all([
      prisma.document.count({
        where: {
          team: {
            organisationId: organisation.id,
          },
          createdAt: {
            gte: DateTime.utc().startOf('month').toJSDate(),
          },
          source: {
            not: DocumentSource.TEMPLATE_DIRECT_LINK,
          },
        },
      }),
      prisma.template.count({
        where: {
          team: {
            organisationId: organisation.id,
          },
          directLink: {
            isNot: null,
          },
        },
      }),
    ]);

    remaining.documents = Math.max(remaining.documents - documents, 0);
    remaining.directTemplates = Math.max(remaining.directTemplates - directTemplates, 0);

    return {
      quota,
      remaining,
    };
  }

  return {
    quota: PAID_PLAN_LIMITS,
    remaining: PAID_PLAN_LIMITS,
  };
};
