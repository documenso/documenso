import {
  ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP,
  ORGANISATION_USER_ACCOUNT_TYPE,
} from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { jobs } from '@documenso/lib/jobs/client';
import { orphanEnvelopes } from '@documenso/lib/server-only/envelope/orphan-envelopes';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import { ZDeleteOrganisationRequestSchema, ZDeleteOrganisationResponseSchema } from './delete-organisation.types';

export const deleteOrganisationRoute = authenticatedProcedure
  //   .meta(deleteOrganisationMeta)
  .input(ZDeleteOrganisationRequestSchema)
  .output(ZDeleteOrganisationResponseSchema)
  .mutation(async ({ input, ctx }) => {
    const { organisationId } = input;
    const { user } = ctx;

    ctx.logger.info({
      input: {
        organisationId,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId: user.id,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['DELETE_ORGANISATION'],
      }),
      select: {
        id: true,
        owner: {
          select: {
            id: true,
          },
        },
        teams: {
          select: {
            id: true,
          },
        },
        subscription: {
          select: {
            planId: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'You are not authorized to delete this organisation',
      });
    }

    // Orphan all envelopes to get rid of foreign key constraints.
    await Promise.all(organisation.teams.map(async (team) => orphanEnvelopes({ teamId: team.id })));

    await prisma.$transaction(async (tx) => {
      await tx.account.deleteMany({
        where: {
          type: ORGANISATION_USER_ACCOUNT_TYPE,
          provider: organisation.id,
        },
      });

      await tx.organisation.delete({
        where: {
          id: organisation.id,
        },
      });
    });

    // If the organisation has a Stripe subscription, schedule it to be
    // cancelled at the end of the current billing period. The job runs
    // asynchronously so a Stripe outage doesn't block deletion, and is
    // retried by the job runner if Stripe is temporarily unavailable.
    if (organisation.subscription) {
      await jobs.triggerJob({
        name: 'internal.cancel-organisation-subscription',
        payload: {
          stripeSubscriptionId: organisation.subscription.planId,
          organisationId: organisation.id,
        },
      });
    }
  });
