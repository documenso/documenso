import type { OrganisationGroup, OrganisationMemberRole } from '@prisma/client';
import { OrganisationGroupType, OrganisationMemberInviteStatus } from '@prisma/client';

import { prisma } from '@documenso/prisma';

import { AppError, AppErrorCode } from '../../errors/app-error';
import { jobs } from '../../jobs/client';
import { generateDatabaseId } from '../../universal/id';

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
          groups: true,
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
    select: {
      id: true,
    },
  });

  if (!user) {
    throw new AppError(AppErrorCode.NOT_FOUND, {
      message: 'User must exist to accept an organisation invitation',
    });
  }

  const { organisation } = organisationMemberInvite;

  const isUserPartOfOrganisation = await prisma.organisationMember.findFirst({
    where: {
      userId: user.id,
      organisationId: organisation.id,
    },
  });

  if (isUserPartOfOrganisation) {
    return;
  }

  await addUserToOrganisation({
    userId: user.id,
    organisationId: organisation.id,
    organisationGroups: organisation.groups,
    organisationMemberRole: organisationMemberInvite.organisationRole,
  });

  await prisma.organisationMemberInvite.update({
    where: {
      id: organisationMemberInvite.id,
    },
    data: {
      status: OrganisationMemberInviteStatus.ACCEPTED,
    },
  });
};

export const addUserToOrganisation = async ({
  userId,
  organisationId,
  organisationGroups,
  organisationMemberRole,
  bypassEmail = false,
}: {
  userId: number;
  organisationId: string;
  organisationGroups: OrganisationGroup[];
  organisationMemberRole: OrganisationMemberRole;
  bypassEmail?: boolean;
}) => {
  const organisationGroupToUse = organisationGroups.find(
    (group) =>
      group.type === OrganisationGroupType.INTERNAL_ORGANISATION &&
      group.organisationRole === organisationMemberRole,
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
          id: generateDatabaseId('member'),
          userId,
          organisationId,
          organisationGroupMembers: {
            create: {
              id: generateDatabaseId('group_member'),
              groupId: organisationGroupToUse.id,
            },
          },
        },
      });

      if (!bypassEmail) {
        await jobs.triggerJob({
          name: 'send.organisation-member-joined.email',
          payload: {
            organisationId,
            memberUserId: userId,
          },
        });
      }
    },
    { timeout: 30_000 },
  );
};
