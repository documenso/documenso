import { syncMemberCountWithStripeSeatPlan } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { validateIfSubscriptionIsRequired } from '@documenso/lib/utils/billing';
import { buildOrganisationWhereQuery } from '@documenso/lib/utils/organisations';
import { prisma } from '@documenso/prisma';

import { authenticatedProcedure } from '../trpc';
import {
  ZDeleteOrganisationMemberInvitesRequestSchema,
  ZDeleteOrganisationMemberInvitesResponseSchema,
} from './delete-organisation-member-invites.types';

export const deleteOrganisationMemberInvitesRoute = authenticatedProcedure
  //   .meta(deleteOrganisationMemberInvitesMeta)
  .input(ZDeleteOrganisationMemberInvitesRequestSchema)
  .output(ZDeleteOrganisationMemberInvitesResponseSchema)
  .mutation(async ({ ctx, input }) => {
    const { organisationId, invitationIds } = input;
    const userId = ctx.user.id;

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery(
        organisationId,
        userId,
        ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      ),
      include: {
        organisationClaim: true,
        subscription: true,
        members: {
          select: {
            id: true,
          },
        },
        invites: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!organisation) {
      throw new AppError(AppErrorCode.NOT_FOUND);
    }

    const { organisationClaim } = organisation;

    const subscription = validateIfSubscriptionIsRequired(organisation.subscription);

    const numberOfCurrentMembers = organisation.members.length;
    const numberOfCurrentInvites = organisation.invites.length;
    const totalMemberCountWithInvites = numberOfCurrentMembers + numberOfCurrentInvites - 1;

    if (subscription) {
      await syncMemberCountWithStripeSeatPlan(
        subscription,
        organisationClaim,
        totalMemberCountWithInvites,
      );
    }

    await prisma.organisationMemberInvite.deleteMany({
      where: {
        id: {
          in: invitationIds,
        },
        organisationId,
      },
    });
  });
