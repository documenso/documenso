import { OrganisationGroupType, OrganisationMemberInviteStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';

export type AcceptOrganisationInvitationOptions = {
  token: string;
};

export const acceptOrganisationInvitation = async ({
  token,
}: AcceptOrganisationInvitationOptions) => {
  const organisationMemberInvite = await prisma.organisationMemberInvite.findFirst({
    where: {
      token,
      status: {
        not: OrganisationMemberInviteStatus.DECLINED,
      },
    },
    include: {
      organisation: {
        include: {
          subscriptions: true,
          groups: {
            include: {
              teamGroups: true,
            },
          },
        },
      },
    },
  });

  if (!organisationMemberInvite) {
    throw new AppError(AppErrorCode.NOT_FOUND);
  }

  if (organisationMemberInvite.status === OrganisationMemberInviteStatus.ACCEPTED) {
    return;
  }

  const user = await prisma.user.findFirst({
    where: {
      email: organisationMemberInvite.email,
    },
  });

  // If no user exists for the invitation, accept the invitation and create the organisation
  // user when the user signs up.
  if (!user) {
    await prisma.organisationMemberInvite.update({
      where: {
        id: organisationMemberInvite.id,
      },
      data: {
        status: OrganisationMemberInviteStatus.ACCEPTED,
      },
    });

    return;
  }

  const { organisation } = organisationMemberInvite;

  const organisationGroupToUse = organisation.groups.find(
    (group) =>
      group.type === OrganisationGroupType.INTERNAL_ORGANISATION &&
      group.organisationRole === organisationMemberInvite.organisationRole,
  );

  if (!organisationGroupToUse) {
    throw new AppError(AppErrorCode.UNKNOWN_ERROR, {
      message: 'Organisation group not found',
    });
  }

  await prisma.$transaction(
    async (tx) => {
      await tx.organisationMember.create({
        data: {
          userId: user.id,
          organisationId: organisation.id,
          organisationGroupMembers: {
            create: {
              groupId: organisationGroupToUse.id,
            },
          },
        },
      });

      await tx.organisationMemberInvite.update({
        where: {
          id: organisationMemberInvite.id,
        },
        data: {
          status: OrganisationMemberInviteStatus.ACCEPTED,
        },
      });

      // Todo: Orgs
      // if (IS_BILLING_ENABLED() && team.subscription) {
      //   const numberOfSeats = await tx.teamMember.count({
      //     where: {
      //       teamId: organisationMemberInvite.teamId,
      //     },
      //   });

      //   await updateSubscriptionItemQuantity({
      //     priceId: team.subscription.priceId,
      //     subscriptionId: team.subscription.planId,
      //     quantity: numberOfSeats,
      //   });
      // }

      // await jobs.triggerJob({
      //   name: 'send.team-member-joined.email',
      //   payload: {
      //     teamId: teamMember.teamId,
      //     memberId: teamMember.id,
      //   },
      // });
    },
    { timeout: 30_000 },
  );
};
