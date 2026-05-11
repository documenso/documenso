import { syncMemberCountWithStripeSeatPlan } from '@documenso/ee/server-only/stripe/update-subscription-item-quantity';
import { ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP } from '@documenso/lib/constants/organisations';
import { AppError, AppErrorCode } from '@documenso/lib/errors/app-error';
import { getMemberOrganisationRole } from '@documenso/lib/server-only/team/get-member-roles';
import {
  buildOrganisationWhereQuery,
  isOrganisationRoleWithinUserHierarchy,
} from '@documenso/lib/utils/organisations';
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

    ctx.logger.info({
      input: {
        organisationId,
        invitationIds,
      },
    });

    const organisation = await prisma.organisation.findFirst({
      where: buildOrganisationWhereQuery({
        organisationId,
        userId,
        roles: ORGANISATION_MEMBER_ROLE_PERMISSIONS_MAP['MANAGE_ORGANISATION'],
      }),
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

    const currentOrganisationMemberRole = await getMemberOrganisationRole({
      organisationId: organisation.id,
      reference: {
        type: 'User',
        id: userId,
      },
    });

    const invitesToDelete = await prisma.organisationMemberInvite.findMany({
      where: {
        id: {
          in: invitationIds,
        },
        organisationId: organisation.id,
      },
      select: {
        id: true,
        organisationRole: true,
      },
    });

    const hasUnauthorizedRoleAccess = invitesToDelete.some(
      (invite) =>
        !isOrganisationRoleWithinUserHierarchy(
          currentOrganisationMemberRole,
          invite.organisationRole,
        ),
    );

    if (hasUnauthorizedRoleAccess) {
      throw new AppError(AppErrorCode.UNAUTHORIZED, {
        message: 'User does not have permission to delete invitations for higher roles',
      });
    }

    const { organisationClaim } = organisation;

    const numberOfCurrentMembers = organisation.members.length;
    const numberOfCurrentInvites = organisation.invites.length;
    const totalMemberCountWithInvites = numberOfCurrentMembers + numberOfCurrentInvites - 1;

    // Removing pending invites is a reducing operation, so we don't gate it on
    // the subscription being present. Sync Stripe only when one exists.
    if (organisation.subscription) {
      await syncMemberCountWithStripeSeatPlan(
        organisation.subscription,
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
