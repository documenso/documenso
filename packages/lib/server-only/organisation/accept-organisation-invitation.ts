import { OrganisationGroupType, OrganisationMemberInviteStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobs } from '../../jobs/client';

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

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User must exist to accept an organisation invitation',
    });
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

      await jobs.triggerJob({
        name: 'send.organisation-member-joined.email',
        payload: {
          organisationId: organisation.id,
          memberUserId: user.id,
        },
      });
    },
    { timeout: 30_000 },
  );
};
